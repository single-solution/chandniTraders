import {
	assistantReplyMatchesLanguage,
	buildAssistantSystemPrompt,
	callAssistantCompletion,
	detectCustomerMessageLanguage,
	buildLanguageRetryInstruction,
	isAssistantProviderConfigured,
	normalizeChatAssistantProvider,
	resolveAssistantModelFromSettings,
	type AssistantChatMessage,
	type ChatAssistantRuntimeSettings,
	type ChatAssistantProvider,
	logger,
} from "@store/shared";

import { buildAssistantStoreContext } from "@/lib/chat/assistant/storeContext";
import { ASSISTANT_TOOL_SCHEMAS, executeAssistantTool, type AssistantToolContext } from "@/lib/chat/assistant/tools";

/** Max rounds where the model may request tools before it must answer in text. */
const MAX_TOOL_ROUNDS = 3;

export interface AssistantChatTurn {
	role: "user" | "assistant";
	content: string;
}

export interface GenerateAssistantReplyInput {
	settings: ChatAssistantRuntimeSettings;
	customerMessage: string;
	subjectProductId?: string;
	subjectProductName?: string;
	/** Session-verified customer id; enables own-order answers. Never from user input. */
	verifiedCustomerId?: string;
	history: AssistantChatTurn[];
	/** Thread is escalated and still awaiting a human — reassure, don't re-open the issue. */
	awaitingHuman?: boolean;
}

export interface GenerateAssistantReplyResult {
	reply: string;
	model: string;
	provider: ChatAssistantProvider;
	/** Set when the model asked to bring in a human teammate. */
	escalation?: { requested: boolean; reason?: string };
}

type ProviderApiKeySettings = Pick<ChatAssistantRuntimeSettings, "providerApiKeyOpenai" | "providerApiKeyGoogle" | "providerApiKeyAnthropic">;

/** Admin-dashboard key for the active provider; falls back to env inside the provider check. */
export function resolveProviderApiKey(provider: ChatAssistantProvider, settings: ProviderApiKeySettings): string | undefined {
	if (provider === "google") {
		return settings.providerApiKeyGoogle || undefined;
	}
	if (provider === "anthropic") {
		return settings.providerApiKeyAnthropic || undefined;
	}
	return settings.providerApiKeyOpenai || undefined;
}

export function isAssistantConfigured(provider?: ChatAssistantProvider, apiKey?: string): boolean {
	if (provider) {
		return isAssistantProviderConfigured(provider, apiKey);
	}
	return isAssistantProviderConfigured("openai") || isAssistantProviderConfigured("google") || isAssistantProviderConfigured("anthropic");
}

export async function generateAssistantReply(input: GenerateAssistantReplyInput): Promise<GenerateAssistantReplyResult | null> {
	const provider = normalizeChatAssistantProvider(input.settings.assistantProvider);
	const apiKey = resolveProviderApiKey(provider, input.settings);
	if (!isAssistantProviderConfigured(provider, apiKey)) {
		return null;
	}

	const model = resolveAssistantModelFromSettings(provider, input.settings);
	const context = await buildAssistantStoreContext({
		customerMessage: input.customerMessage,
		subjectProductId: input.subjectProductId,
		subjectProductName: input.subjectProductName,
		verifiedCustomerId: input.verifiedCustomerId,
	});

	const requiredLanguage = detectCustomerMessageLanguage(input.customerMessage);

	const system = buildAssistantSystemPrompt(context, input.settings.assistantName, {
		instructions: input.settings.assistantInstructions,
		awaitingHuman: input.awaitingHuman,
		requiredLanguage,
	});

	const messages: AssistantChatMessage[] = [
		{ role: "system", content: system },
		...input.history.map((turn): AssistantChatMessage => (turn.role === "assistant" ? { role: "assistant", content: turn.content } : { role: "user", content: turn.content })),
		{ role: "user", content: input.customerMessage },
	];

	const toolContext: AssistantToolContext = {
		verifiedCustomerId: input.verifiedCustomerId,
		escalation: { requested: false },
	};

	// Tool loop: let the model fetch live facts (catalog/orders/account) or
	// escalate, feeding results back until it answers in plain text.
	let result = await callAssistantCompletion({
		provider,
		model,
		apiKey,
		messages,
		tools: ASSISTANT_TOOL_SCHEMAS,
		temperature: input.settings.assistantTemperature,
		maxTokens: input.settings.assistantMaxTokens,
	});

	let round = 0;
	while (result && result.toolCalls.length > 0 && round < MAX_TOOL_ROUNDS) {
		messages.push({ role: "assistant", content: result.reply, toolCalls: result.toolCalls });
		// Tools in a round are independent (read-only lookups), so run them together
		// and keep message order stable for the provider.
		const outputs = await Promise.all(result.toolCalls.map((call) => executeAssistantTool(call, toolContext)));
		result.toolCalls.forEach((call, index) => {
			messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: outputs[index] });
		});
		round += 1;
		const allowMoreTools = round < MAX_TOOL_ROUNDS;
		result = await callAssistantCompletion({
			provider,
			model,
			apiKey,
			messages,
			tools: allowMoreTools ? ASSISTANT_TOOL_SCHEMAS : undefined,
			temperature: input.settings.assistantTemperature,
			maxTokens: input.settings.assistantMaxTokens,
		});
	}

	if (!result) {
		logger.error({ provider, model }, "chat-assistant: provider request failed");
		return null;
	}

	const reply = result.reply.trim();
	if (reply && !assistantReplyMatchesLanguage(reply, requiredLanguage)) {
		logger.warn(
			{ provider, model, requiredLanguage, replyPreview: reply.slice(0, 120) },
			"chat-assistant: language mismatch — retrying once",
		);
		messages.push({ role: "assistant", content: reply });
		messages.push({ role: "user", content: buildLanguageRetryInstruction(requiredLanguage) });
		const retry = await callAssistantCompletion({
			provider,
			model,
			apiKey,
			messages,
			temperature: input.settings.assistantTemperature,
			maxTokens: input.settings.assistantMaxTokens,
		});
		if (retry?.reply?.trim() && assistantReplyMatchesLanguage(retry.reply.trim(), requiredLanguage)) {
			return {
				reply: retry.reply,
				model: retry.model,
				provider: retry.provider,
				escalation: toolContext.escalation.requested ? toolContext.escalation : undefined,
			};
		}
		logger.warn({ provider, model, requiredLanguage }, "chat-assistant: language mismatch after retry");
		return null;
	}

	return {
		reply: result.reply,
		model: result.model,
		provider: result.provider,
		escalation: toolContext.escalation.requested ? toolContext.escalation : undefined,
	};
}
