/** Customer-facing chat title — neutral support branding, never a person name. */
export const CHAT_SUPPORT_DISPLAY_NAME = "Chat Support";

/** Default for `chat.assistantName` (should match storefront display). */
export const CHAT_ASSISTANT_DEFAULT_NAME = CHAT_SUPPORT_DISPLAY_NAME;

/** Admin inbox label for automated replies — never shown on the storefront. */
export const CHAT_ASSISTANT_AI_LABEL = "AI";

export function customerChatSupportLabel(configuredName?: string | null): string {
	const trimmed = configuredName?.trim();
	if (!trimmed || trimmed.toLowerCase() === "sara" || trimmed.toLowerCase() === "store assistant") {
		return CHAT_SUPPORT_DISPLAY_NAME;
	}
	return trimmed;
}
