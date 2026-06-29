"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ChatSettings } from "@/lib/chat/chatSettings";
import { CHAT_SETTING_DEFAULTS } from "@store/shared";

const DEFAULTS: ChatSettings = CHAT_SETTING_DEFAULTS;

const ChatSettingsContext = createContext<ChatSettings>(DEFAULTS);

export function ChatSettingsProvider({ value, children }: { value: ChatSettings; children: ReactNode }) {
	return <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>;
}

export function useChatSettings(): ChatSettings {
	return useContext(ChatSettingsContext);
}
