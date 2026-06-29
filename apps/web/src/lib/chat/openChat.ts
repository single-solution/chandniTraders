export const OPEN_CHAT_EVENT = "store:open-chat";
export const CLOSE_CHAT_EVENT = "store:close-chat";
export const CHAT_OPEN_STATE_EVENT = "store:chat-open-state";

export interface OpenChatDetail {
	initialBody?: string;
	subjectProductId?: string;
	subjectProductName?: string;
}

export interface ChatOpenStateDetail {
	isOpen: boolean;
}

export function openChatWidget(detail: OpenChatDetail = {}): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail }));
}

export function closeChatWidget(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(CLOSE_CHAT_EVENT));
}

/** Lets chrome (e.g. mobile tab bar) mirror chat open/closed state. */
export function dispatchChatOpenState(isOpen: boolean): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<ChatOpenStateDetail>(CHAT_OPEN_STATE_EVENT, {
			detail: { isOpen },
		}),
	);
}
