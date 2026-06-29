import type { ChatAttachment, ChatMessageAuthor, ChatStatus } from "./chat/types";
import { CHAT_MESSAGE_AUTHORS, CHAT_STATUSES } from "./chat/types";
import { isStoredImage } from "./storage/types";

const EPOCH = new Date(0);

export function coerceDate(value: unknown): Date | null {
	if (!value) {
		return null;
	}
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date;
}

export function toIsoDate(value: unknown, fallback: Date = EPOCH): string {
	return (coerceDate(value) ?? fallback).toISOString();
}

export function toMillis(value: unknown, fallback = 0): number {
	return coerceDate(value)?.getTime() ?? fallback;
}

export function asArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function objectIdString(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}
	if (!value || typeof value !== "object" || !("toString" in value)) {
		return "";
	}
	return String(value);
}

export function normalizeChatStatus(value: unknown): ChatStatus {
	if (typeof value === "string" && CHAT_STATUSES.includes(value as ChatStatus)) {
		return value as ChatStatus;
	}
	if (value === "pending" || value === "new") {
		return "open";
	}
	return "open";
}

export function normalizeChatMessageAuthor(value: unknown): ChatMessageAuthor {
	if (typeof value === "string" && CHAT_MESSAGE_AUTHORS.includes(value as ChatMessageAuthor)) {
		return value as ChatMessageAuthor;
	}
	return "customer";
}

export function normalizeChatAttachment(value: unknown): ChatAttachment | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const attachment = value as Record<string, unknown>;
	if (attachment.kind === "image" && isStoredImage(attachment.image)) {
		return {
			kind: "image",
			image: attachment.image,
		};
	}
	if (attachment.kind !== "file") {
		return null;
	}
	const url = asString(attachment.url);
	const mime = asString(attachment.mime);
	const filename = asString(attachment.filename);
	if (!url || !mime || !filename) {
		return null;
	}
	return {
		kind: "file",
		url,
		mime,
		filename,
		sizeBytes: asNumber(attachment.sizeBytes),
	};
}
