import type { ChatMessage } from "./types";

/** Guest preview messages before sign-in is required. */
export const CHAT_GUEST_MESSAGE_LIMIT = 5;

export function isAnonymousChatPhone(phoneNumber: string): boolean {
	return phoneNumber.startsWith("anon:");
}

export function countCustomerChatMessages(messages: Pick<ChatMessage, "author">[]): number {
	return messages.filter((message) => message.author === "customer").length;
}

export function guestChatLoginRequired(input: { customerId?: string; phoneNumber: string; guestMessageLimit: number; messages: Pick<ChatMessage, "author">[] }): boolean {
	if (input.customerId) {
		return false;
	}
	if (!isAnonymousChatPhone(input.phoneNumber)) {
		return false;
	}
	return countCustomerChatMessages(input.messages) >= input.guestMessageLimit;
}
