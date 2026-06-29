/**
 * Store chat assistant LLM providers — selectable from admin settings.
 *
 * Supports single-shot replies AND function/tool calling: the model may ask to
 * run named tools (catalog search, the customer's own orders, escalation), the
 * caller executes them, feeds the results back, and the model continues until
 * it produces a plain-text reply. All three providers (OpenAI, Google Gemini,
 * Anthropic) are normalised to the same `AssistantChatMessage` / tool shapes.
 */

import { logger } from "../logger";

export const CHAT_ASSISTANT_PROVIDERS = ["openai", "google", "anthropic"] as const;
export type ChatAssistantProvider = (typeof CHAT_ASSISTANT_PROVIDERS)[number];

export const CHAT_ASSISTANT_PROVIDER_LABELS: Record<ChatAssistantProvider, string> = {
	openai: "OpenAI",
	google: "Google Gemini",
	anthropic: "Anthropic Claude",
};

export const CHAT_ASSISTANT_DEFAULT_MODELS: Record<ChatAssistantProvider, string> = {
	openai: "gpt-4o-mini",
	google: "gemini-2.5-flash-lite",
	anthropic: "claude-3-5-sonnet-latest",
};

const MAX_MODEL_OVERRIDE_LENGTH = 80;
const DEFAULT_TEMPERATURE = 0.38;
const DEFAULT_MAX_TOKENS = 500;
const ANTHROPIC_API_VERSION = "2023-06-01";

export function normalizeChatAssistantProvider(value: unknown, fallback: ChatAssistantProvider = "openai"): ChatAssistantProvider {
	return value === "google" || value === "openai" || value === "anthropic" ? value : fallback;
}

export function resolveAssistantModel(provider: ChatAssistantProvider, modelOverride?: string): string {
	const trimmed = modelOverride?.trim();
	if (trimmed) {
		return trimmed.slice(0, MAX_MODEL_OVERRIDE_LENGTH);
	}
	if (provider === "google") {
		return process.env.GEMINI_CHAT_MODEL?.trim() || CHAT_ASSISTANT_DEFAULT_MODELS.google;
	}
	if (provider === "anthropic") {
		return process.env.ANTHROPIC_CHAT_MODEL?.trim() || CHAT_ASSISTANT_DEFAULT_MODELS.anthropic;
	}
	return process.env.OPENAI_CHAT_MODEL?.trim() || CHAT_ASSISTANT_DEFAULT_MODELS.openai;
}

export function isAssistantProviderConfigured(provider: ChatAssistantProvider, apiKeyOverride?: string): boolean {
	if (apiKeyOverride?.trim()) return true;
	if (provider === "google") {
		return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
	}
	if (provider === "anthropic") {
		return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
	}
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** A function the model can ask to run. `parameters` is a JSON-Schema object. */
export interface AssistantToolSchema {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

/** A single tool invocation requested by the model. */
export interface AssistantToolCall {
	/** Provider-supplied id (synthesised for Gemini, which omits one). */
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export type AssistantChatMessage =
	| { role: "system"; content: string }
	| { role: "user"; content: string }
	| { role: "assistant"; content: string; toolCalls?: AssistantToolCall[] }
	| { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface AssistantCompletionInput {
	provider: ChatAssistantProvider;
	model: string;
	apiKey?: string;
	messages: AssistantChatMessage[];
	/** When present, the model may request these tools instead of replying. */
	tools?: AssistantToolSchema[];
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
}

export interface AssistantCompletionResult {
	/** Plain-text reply. Empty string when the model only asked for tools. */
	reply: string;
	/** Tools the model wants executed before it can answer. */
	toolCalls: AssistantToolCall[];
	model: string;
	provider: ChatAssistantProvider;
}

interface ProviderCall {
	reply: string | null;
	toolCalls: AssistantToolCall[];
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const ANTHROPIC_CHAT_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Read a failed provider response body (truncated, no secrets) so the real
 * cause — invalid key (401), bad model (400/404), rate limit/quota (429) — lands
 * in logs instead of being swallowed into the generic customer fallback.
 */
async function logProviderHttpError(provider: ChatAssistantProvider, model: string, response: Response): Promise<void> {
	let body = "";
	try {
		body = (await response.text()).slice(0, 300);
	} catch {
		// Body already consumed or unreadable — status alone is still useful.
	}
	logger.warn({ provider, model, status: response.status, body }, "chat-assistant: provider HTTP error");
}

function safeParseArguments(raw: unknown): Record<string, unknown> {
	if (raw && typeof raw === "object") {
		return raw as Record<string, unknown>;
	}
	if (typeof raw !== "string" || !raw.trim()) {
		return {};
	}
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────

async function callOpenAi(
	model: string,
	apiKeyOverride: string | undefined,
	messages: AssistantChatMessage[],
	options: { temperature: number; maxTokens: number; tools?: AssistantToolSchema[] },
	signal?: AbortSignal,
): Promise<ProviderCall | null> {
	const apiKey = apiKeyOverride?.trim() || process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return null;
	}

	const body = messages.map((message) => {
		if (message.role === "tool") {
			return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
		}
		if (message.role === "assistant" && message.toolCalls?.length) {
			return {
				role: "assistant",
				content: message.content || null,
				tool_calls: message.toolCalls.map((call) => ({
					id: call.id,
					type: "function",
					function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
				})),
			};
		}
		return { role: message.role, content: message.content };
	});

	const response = await fetch(OPENAI_CHAT_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages: body,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
			...(options.tools?.length
				? {
						tools: options.tools.map((tool) => ({
							type: "function",
							function: {
								name: tool.name,
								description: tool.description,
								parameters: tool.parameters,
							},
						})),
						tool_choice: "auto",
					}
				: {}),
		}),
		signal,
	});

	if (!response.ok) {
		await logProviderHttpError("openai", model, response);
		return null;
	}

	const payload = (await response.json()) as {
		choices?: Array<{
			message?: {
				content?: string;
				tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
			};
		}>;
	};
	const message = payload.choices?.[0]?.message;
	const toolCalls = (message?.tool_calls ?? [])
		.filter((call) => call.function?.name)
		.map((call) => ({
			id: call.id ?? call.function?.name ?? "unknown-tool",
			name: call.function?.name ?? "unknown-tool",
			arguments: safeParseArguments(call.function?.arguments),
		}));
	return { reply: message?.content?.trim() ?? null, toolCalls };
}

// ─── Google Gemini ──────────────────────────────────────────────────────────

function toGeminiContents(messages: AssistantChatMessage[]) {
	const contents: Array<{ role: "user" | "model"; parts: unknown[] }> = [];

	for (const message of messages) {
		if (message.role === "system") {
			continue;
		}
		if (message.role === "tool") {
			const part = {
				functionResponse: {
					name: message.toolName,
					response: { result: message.content },
				},
			};
			const last = contents[contents.length - 1];
			// Gemini wants tool results grouped into one user turn.
			if (last && last.role === "user" && last.parts.every((part) => "functionResponse" in (part as object))) {
				last.parts.push(part);
			} else {
				contents.push({ role: "user", parts: [part] });
			}
			continue;
		}
		if (message.role === "assistant") {
			const parts: unknown[] = [];
			if (message.content) {
				parts.push({ text: message.content });
			}
			for (const call of message.toolCalls ?? []) {
				parts.push({ functionCall: { name: call.name, args: call.arguments ?? {} } });
			}
			contents.push({ role: "model", parts });
			continue;
		}
		contents.push({ role: "user", parts: [{ text: message.content }] });
	}

	return contents;
}

async function callGemini(
	model: string,
	apiKeyOverride: string | undefined,
	messages: AssistantChatMessage[],
	options: { temperature: number; maxTokens: number; tools?: AssistantToolSchema[] },
	signal?: AbortSignal,
): Promise<ProviderCall | null> {
	const apiKey = apiKeyOverride?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
	if (!apiKey) {
		return null;
	}

	const systemMessage = messages.find((message) => message.role === "system");
	// Key goes in a header, not the query string, so it can't leak via URL logging.
	const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
		body: JSON.stringify({
			...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
			contents: toGeminiContents(messages),
			...(options.tools?.length
				? {
						tools: [
							{
								functionDeclarations: options.tools.map((tool) => {
									const properties = (tool.parameters?.properties ?? {}) as Record<string, unknown>;
									// Gemini rejects declarations with an empty `properties` map —
									// omit `parameters` entirely for no-argument tools.
									return {
										name: tool.name,
										description: tool.description,
										...(Object.keys(properties).length > 0 ? { parameters: tool.parameters } : {}),
									};
								}),
							},
						],
					}
				: {}),
			generationConfig: {
				temperature: options.temperature,
				maxOutputTokens: options.maxTokens,
			},
		}),
		signal,
	});

	if (!response.ok) {
		await logProviderHttpError("google", model, response);
		return null;
	}

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: {
				parts?: Array<{
					text?: string;
					functionCall?: { name?: string; args?: Record<string, unknown> };
				}>;
			};
		}>;
	};
	const parts = payload.candidates?.[0]?.content?.parts ?? [];
	const texts: string[] = [];
	const toolCalls: AssistantToolCall[] = [];
	parts.forEach((part, index) => {
		if (part.text) {
			texts.push(part.text);
		}
		if (part.functionCall?.name) {
			toolCalls.push({
				id: `${part.functionCall.name}-${index}`,
				name: part.functionCall.name,
				arguments: part.functionCall.args ?? {},
			});
		}
	});
	const reply = texts.join("").trim();
	return { reply: reply || null, toolCalls };
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

function toAnthropicMessages(messages: AssistantChatMessage[]) {
	const result: Array<{ role: "user" | "assistant"; content: unknown[] }> = [];

	for (const message of messages) {
		if (message.role === "system") {
			continue;
		}
		if (message.role === "tool") {
			const block = {
				type: "tool_result",
				tool_use_id: message.toolCallId,
				content: message.content,
			};
			const last = result[result.length - 1];
			if (last && last.role === "user") {
				last.content.push(block);
			} else {
				result.push({ role: "user", content: [block] });
			}
			continue;
		}
		if (message.role === "assistant") {
			const blocks: unknown[] = [];
			if (message.content) {
				blocks.push({ type: "text", text: message.content });
			}
			for (const call of message.toolCalls ?? []) {
				blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments ?? {} });
			}
			result.push({ role: "assistant", content: blocks });
			continue;
		}
		result.push({ role: "user", content: [{ type: "text", text: message.content }] });
	}

	return result;
}

async function callAnthropic(
	model: string,
	apiKeyOverride: string | undefined,
	messages: AssistantChatMessage[],
	options: { temperature: number; maxTokens: number; tools?: AssistantToolSchema[] },
	signal?: AbortSignal,
): Promise<ProviderCall | null> {
	const apiKey = apiKeyOverride?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
	if (!apiKey) {
		return null;
	}

	const systemMessage = messages.find((message) => message.role === "system");
	const response = await fetch(ANTHROPIC_CHAT_URL, {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": ANTHROPIC_API_VERSION,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages: toAnthropicMessages(messages),
			...(systemMessage ? { system: systemMessage.content } : {}),
			temperature: options.temperature,
			max_tokens: options.maxTokens,
			...(options.tools?.length
				? {
						tools: options.tools.map((tool) => ({
							name: tool.name,
							description: tool.description,
							input_schema: tool.parameters,
						})),
					}
				: {}),
		}),
		signal,
	});

	if (!response.ok) {
		await logProviderHttpError("anthropic", model, response);
		return null;
	}

	const payload = (await response.json()) as {
		content?: Array<{
			type?: string;
			text?: string;
			id?: string;
			name?: string;
			input?: Record<string, unknown>;
		}>;
	};
	const texts: string[] = [];
	const toolCalls: AssistantToolCall[] = [];
	for (const block of payload.content ?? []) {
		if (block.type === "text" && block.text) {
			texts.push(block.text);
		}
		if (block.type === "tool_use" && block.name) {
			toolCalls.push({
				id: block.id ?? block.name,
				name: block.name,
				arguments: block.input ?? {},
			});
		}
	}
	const reply = texts.join("").trim();
	return { reply: reply || null, toolCalls };
}

export async function callAssistantCompletion(input: AssistantCompletionInput): Promise<AssistantCompletionResult | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const signal = input.signal ?? controller.signal;

	try {
		const generation = {
			temperature: input.temperature ?? DEFAULT_TEMPERATURE,
			maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
			tools: input.tools,
		};

		let raw: ProviderCall | null = null;
		if (input.provider === "google") {
			raw = await callGemini(input.model, input.apiKey, input.messages, generation, signal);
		} else if (input.provider === "anthropic") {
			raw = await callAnthropic(input.model, input.apiKey, input.messages, generation, signal);
		} else {
			raw = await callOpenAi(input.model, input.apiKey, input.messages, generation, signal);
		}

		if (!raw) {
			return null;
		}

		return {
			reply: raw.reply ?? "",
			toolCalls: raw.toolCalls,
			model: input.model,
			provider: input.provider,
		};
	} catch (error) {
		// AbortError = our own 12s timeout fired; anything else is a network/DNS
		// failure reaching the provider. Either way, log the reason and return
		// null so the caller serves the safe fallback instead of throwing into a
		// no-reply for the customer.
		const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
		logger.warn(
			{ provider: input.provider, model: input.model, reason, error: error instanceof Error ? error.message : String(error) },
			"chat-assistant: provider call threw",
		);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
