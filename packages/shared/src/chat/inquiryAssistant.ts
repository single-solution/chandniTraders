/** Why the AI assistant is paused on a single inquiry thread. */
export const ASSISTANT_MUTE_REASONS = ["escalation", "manual"] as const;
export type AssistantMuteReason = (typeof ASSISTANT_MUTE_REASONS)[number];

export function isAssistantMuteReason(value: unknown): value is AssistantMuteReason {
	return typeof value === "string" && (ASSISTANT_MUTE_REASONS as readonly string[]).includes(value);
}

interface MuteSource {
	assistantMuted?: boolean;
	assistantMuteReason?: string | null;
	escalatedAt?: Date | string | null;
}

/** Resolve mute reason for legacy threads that only had `assistantMuted` + `escalatedAt`. */
export function resolveAssistantMuteReason(inquiry: MuteSource): AssistantMuteReason | null {
	if (!inquiry.assistantMuted) {
		return null;
	}
	if (isAssistantMuteReason(inquiry.assistantMuteReason)) {
		return inquiry.assistantMuteReason;
	}
	if (inquiry.escalatedAt) {
		return "escalation";
	}
	return "manual";
}

export function isAssistantBotPaused(inquiry: MuteSource): boolean {
	return inquiry.assistantMuted === true;
}
