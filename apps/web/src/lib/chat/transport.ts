/**
 * Storefront chat transport client (polling today; signatures mirror a future live transport).
 */

import type { ChatMessage, ChatThread, ChatThreadSummary } from "@store/shared";

import type { ChatSettings } from "./chatSettings";

export interface ChatBootstrap {
	enabled: boolean;
	threads: ChatThreadSummary[];
	settings: ChatSettings;
	/** True when the caller is a signed-in storefront customer (not staff). */
	isSignedInCustomer: boolean;
}

export class ChatRequestError extends Error {
	code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.code = code;
	}
}

async function jsonOrThrow(res: Response): Promise<unknown> {
	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		let code: string | undefined;
		try {
			const body = (await res.json()) as { error?: string; code?: string };
			if (body?.error) message = body.error;
			code = body?.code;
		} catch {
			// fall through
		}
		throw new ChatRequestError(message, code);
	}
	return res.json();
}

export async function fetchChatBootstrap(): Promise<ChatBootstrap> {
	const res = await fetch("/api/chat", {
		method: "GET",
		credentials: "same-origin",
		cache: "no-store",
	});
	return (await jsonOrThrow(res)) as ChatBootstrap;
}

export async function fetchChatThread(id: string): Promise<ChatThread> {
	const res = await fetch(`/api/chat/${encodeURIComponent(id)}`, {
		method: "GET",
		credentials: "same-origin",
		cache: "no-store",
	});
	return (await jsonOrThrow(res)) as ChatThread;
}

/** Fetch the page of messages immediately older than `beforeId` (scroll-up). */
export async function fetchOlderChatMessages(id: string, beforeId: string): Promise<ChatThread> {
	const params = new URLSearchParams({ before: beforeId });
	const res = await fetch(`/api/chat/${encodeURIComponent(id)}?${params}`, {
		method: "GET",
		credentials: "same-origin",
		cache: "no-store",
	});
	return (await jsonOrThrow(res)) as ChatThread;
}

/** Poll tick — returns `null` when the server responds 304 (unchanged). */
export async function pollChatThread(id: string, since: string, etag?: string): Promise<ChatThread | null> {
	const params = new URLSearchParams({ since });
	const res = await fetch(`/api/chat/${encodeURIComponent(id)}?${params}`, {
		method: "GET",
		credentials: "same-origin",
		cache: "no-store",
		headers: etag ? { "If-None-Match": etag } : undefined,
	});
	if (res.status === 304) return null;
	return (await jsonOrThrow(res)) as ChatThread;
}

export async function fetchChatUnreadSummary(): Promise<number> {
	const res = await fetch("/api/chat?summary=1", {
		method: "GET",
		credentials: "same-origin",
		cache: "no-store",
	});
	const data = (await jsonOrThrow(res)) as { unreadByCustomer: number };
	return data.unreadByCustomer;
}

export async function markChatThreadRead(threadId: string): Promise<void> {
	const res = await fetch(`/api/chat/${encodeURIComponent(threadId)}/read-receipts`, { method: "POST", credentials: "same-origin" });
	if (res.status === 204 || res.status === 304) return;
	if (!res.ok) {
		await jsonOrThrow(res);
	}
}

export interface StartAnonymousChatInput {
	subjectProductId?: string;
	subjectProductName?: string;
}

export async function startAnonymousChatThread(input: StartAnonymousChatInput = {}): Promise<ChatThread> {
	const res = await fetch("/api/chat/anonymous-threads", {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	return (await jsonOrThrow(res)) as ChatThread;
}

export async function startCustomerChatThread(): Promise<ChatThread> {
	const res = await fetch("/api/chat/customer-threads", {
		method: "POST",
		credentials: "same-origin",
	});
	return (await jsonOrThrow(res)) as ChatThread;
}

export async function sendChatMessage(
	threadId: string,
	body: string,
	context?: {
		subjectProductId?: string;
		subjectProductName?: string;
	},
): Promise<ChatThread> {
	const res = await fetch(`/api/chat/${encodeURIComponent(threadId)}/messages`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ body, ...context }),
	});
	return (await jsonOrThrow(res)) as ChatThread;
}

/**
 * Optimistic message stub — used by the composer to render the message
 * locally before the server round-trip. Replaced by the real id when the
 * POST resolves.
 */
export function makeOptimisticMessage(args: { body: string; authorName?: string }): ChatMessage {
	return {
		id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		author: "customer",
		authorName: args.authorName,
		body: args.body,
		createdAt: new Date().toISOString(),
	};
}
