/**
 * DB → public storefront chat shape.
 *
 * The customer side never receives internal admin fields (`internalNotes`,
 * `assignedToUserId`, the agent's `authorUserId` reference). Everything
 * else funnels through the shared `ChatThread` / `ChatMessage` types so
 * the widget and the admin inbox speak the same wire format.
 */

import type { Types } from "mongoose";
import type { InquiryAttributes, InquiryMessageAttributes, WithTimestamps } from "@store/db";
import type { ChatMessage, ChatThread, ChatThreadSummary } from "@store/shared";
import {
	asArray,
	asString,
	CHAT_MESSAGE_PAGE_SIZE,
	normalizeChatAttachment,
	normalizeChatMessageAuthor,
	normalizeChatStatus,
	objectIdString,
	resolveAssistantMuteReason,
	sliceChatMessages,
	toIsoDate,
} from "@store/shared";

export type InquiryLean = WithTimestamps<InquiryAttributes> & {
	_id: Types.ObjectId;
};

function toMessage(message: InquiryMessageAttributes): ChatMessage {
	const attachments = asArray<unknown>(message.attachments)
		.map(normalizeChatAttachment)
		.filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
	return {
		id: objectIdString(message._id),
		author: normalizeChatMessageAuthor(message.author),
		authorName: message.authorName,
		body: asString(message.body),
		attachments: attachments.length > 0 ? attachments : undefined,
		createdAt: toIsoDate(message.createdAt),
		readByCustomerAt: message.readByCustomerAt ? toIsoDate(message.readByCustomerAt) : undefined,
	};
}

export function summariseThread(inquiry: InquiryLean): ChatThreadSummary {
	const pauseReason = resolveAssistantMuteReason(inquiry);
	const assistantPaused = inquiry.assistantMuted === true;
	return {
		id: objectIdString(inquiry._id),
		customerId: objectIdString(inquiry.customerId) || undefined,
		customerName: asString(inquiry.customerName, "Customer"),
		phoneNumber: asString(inquiry.phoneNumber),
		subjectProductId: objectIdString(inquiry.subjectProductId) || undefined,
		subjectProductName: inquiry.subjectProductName,
		status: normalizeChatStatus(inquiry.status),
		lastMessageAt: toIsoDate(inquiry.lastMessageAt, new Date(toIsoDate(inquiry.updatedAt ?? inquiry.createdAt))),
		lastMessagePreview: asString(inquiry.lastMessagePreview),
		lastMessageAuthor: normalizeChatMessageAuthor(inquiry.lastMessageAuthor),
		unreadByCustomer: inquiry.unreadByCustomer ?? 0,
		unreadByTeam: 0,
		assistantPaused,
		assistantPauseReason: pauseReason,
		assistantPausedAt: inquiry.assistantMutedAt ? toIsoDate(inquiry.assistantMutedAt) : undefined,
		createdAt: toIsoDate(inquiry.createdAt),
		updatedAt: toIsoDate(inquiry.updatedAt ?? inquiry.createdAt),
	};
}

export function toThread(inquiry: InquiryLean, page?: { messages: InquiryMessageAttributes[]; hasMoreOlder: boolean }): ChatThread {
	const messages = page?.messages ?? asArray<InquiryMessageAttributes>(inquiry.messages);
	return {
		...summariseThread(inquiry),
		messages: messages.map(toMessage),
		hasMoreOlder: page?.hasMoreOlder ?? false,
	};
}

/**
 * Serialize a thread carrying only its most recent message page (+ a flag for
 * whether older history exists). Use on every endpoint that returns a thread so
 * the wire payload stays bounded and the client can lazy-load older messages.
 */
export function toThreadLatestPage(inquiry: InquiryLean): ChatThread {
	const all = asArray<InquiryMessageAttributes>(inquiry.messages);
	const slice = sliceChatMessages(all, { limit: CHAT_MESSAGE_PAGE_SIZE });
	return toThread(inquiry, {
		messages: all.slice(slice.start, slice.end),
		hasMoreOlder: slice.hasMoreOlder,
	});
}
