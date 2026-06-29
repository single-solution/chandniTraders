/**
 * Shared chat types — single source of truth for `apps/web` (storefront
 * widget + customer account threads) and `apps/admin` (chat inbox).
 *
 * Wire format matches the Mongoose attributes in `@store/db/models/Inquiry`
 * but with `Date → string (ISO)` and `ObjectId → string` so the wire layer
 * stays JSON-safe.
 */

import type { AssistantMuteReason } from "./inquiryAssistant";
import type { StoredImage } from "../storage/types";

export const CHAT_STATUSES = ["open", "awaiting-customer", "resolved"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

export const CHAT_MESSAGE_AUTHORS = ["customer", "agent", "assistant"] as const;
export type ChatMessageAuthor = (typeof CHAT_MESSAGE_AUTHORS)[number];

export interface ChatImageAttachment {
	kind: "image";
	image: StoredImage;
}

export interface ChatFileAttachment {
	kind: "file";
	url: string;
	mime: string;
	sizeBytes: number;
	filename: string;
}

export type ChatAttachment = ChatImageAttachment | ChatFileAttachment;

export interface ChatMessage {
	id: string;
	author: ChatMessageAuthor;
	authorName?: string;
	/** Set when `author === "agent"` — the replying admin user. */
	authorUserId?: string;
	body: string;
	attachments?: ChatAttachment[];
	/** ISO 8601 timestamp. */
	createdAt: string;
	/** ISO timestamp — set when the customer side has loaded this message. */
	readByCustomerAt?: string;
}

export interface ChatThreadSummary {
	id: string;
	customerId?: string;
	customerName: string;
	phoneNumber: string;
	subjectProductId?: string;
	subjectProductName?: string;
	status: ChatStatus;
	assignedToUserId?: string;
	/** ISO 8601 — drives sort order on the inbox + customer account list. */
	lastMessageAt: string;
	lastMessagePreview: string;
	lastMessageAuthor: ChatMessageAuthor;
	unreadByCustomer: number;
	unreadByTeam: number;
	/** True when automated replies are paused on this thread. */
	assistantPaused: boolean;
	assistantPauseReason?: AssistantMuteReason | null;
	/** ISO timestamp — when the bot was paused. */
	assistantPausedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ChatThread extends ChatThreadSummary {
	messages: ChatMessage[];
	/** True when older messages exist before the loaded page (drives "load more"). */
	hasMoreOlder?: boolean;
}

/** Validation regex shared by client + server for the customer's full name. */
export const CHAT_CUSTOMER_NAME_REGEX = /^[\p{L}\p{M}\s.'-]+$/u;
export const CHAT_CUSTOMER_NAME_MIN = 2;
export const CHAT_CUSTOMER_NAME_MAX = 80;
export const CHAT_MESSAGE_BODY_MAX = 4_000;
