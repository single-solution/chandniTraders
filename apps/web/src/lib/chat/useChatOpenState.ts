"use client";

import { useEffect, useState } from "react";
import { CHAT_OPEN_STATE_EVENT, type ChatOpenStateDetail } from "./openChat";

/** Mirrors chat open/closed state for chrome that must stack above the overlay (e.g. mobile tab bar). */
export function useChatOpenState(): boolean {
	const [isChatOpen, setIsChatOpen] = useState(false);

	useEffect(() => {
		function onChatOpenState(event: Event) {
			const detail = (event as CustomEvent<ChatOpenStateDetail>).detail;
			setIsChatOpen(detail?.isOpen ?? false);
		}

		window.addEventListener(CHAT_OPEN_STATE_EVENT, onChatOpenState);
		return () => window.removeEventListener(CHAT_OPEN_STATE_EVENT, onChatOpenState);
	}, []);

	return isChatOpen;
}
