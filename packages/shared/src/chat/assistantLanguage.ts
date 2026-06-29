/**
 * Server-side language lock for the chat assistant.
 * Prompt rules alone drift; this module detects the customer's language and
 * rejects assistant replies that breach the match rule before they are sent.
 */

export type CustomerMessageLanguage = "english" | "roman_urdu" | "urdu_script";

const URDU_SCRIPT_PATTERN = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Roman-Urdu particles — strong signals, not shared with normal English. */
const ROMAN_URDU_MARKER_PATTERN =
	/\b(aapko|aap\s|apko|mujhe|mujhay|muje|hain|hai|nahi|nahin|nhi|kya|kia|kaise|kaun|kyun|kyu|mein|men|bhi|yeh|yehi|woh|koi|batao|bataiye|chahiye|chahte|zyada|mehenga|mehnga|sasta|theek|thik|acha|achha|achhi|bilkul|shukriya|salam|assalam|han|haan|ji\b|bhai|yaar|dekho|dekh|karun|karun|lagao|samajh|samajht|paisa|paise|rehne|sochna|walay|wala|wali|lagta|lagti|stock\s+mein|order\s+kar)\b/gi;

const CORPORATE_ENGLISH_PATTERN = /\b(thank you for reaching|i apologize for the inconvenience|please do not hesitate|dear customer|how may i assist)\b/i;

/**
 * Detect language from the customer's latest message only.
 * Default English when unclear — never assume Roman Urdu without signals.
 */
export function detectCustomerMessageLanguage(message: string): CustomerMessageLanguage {
	const trimmed = message.trim();
	if (!trimmed) {
		return "english";
	}
	if (URDU_SCRIPT_PATTERN.test(trimmed)) {
		return "urdu_script";
	}

	const words = trimmed.split(/\s+/).filter(Boolean);
	const markerMatches = trimmed.match(ROMAN_URDU_MARKER_PATTERN) ?? [];
	const markerCount = markerMatches.length;
	const markerRatio = markerCount / Math.max(words.length, 1);

	if (markerCount >= 2 || (words.length >= 4 && markerRatio >= 0.15)) {
		return "roman_urdu";
	}

	return "english";
}

function countRomanUrduMarkers(text: string): number {
	return text.match(ROMAN_URDU_MARKER_PATTERN)?.length ?? 0;
}

function containsUrduScript(text: string): boolean {
	return URDU_SCRIPT_PATTERN.test(text);
}

/** Markdown deal tables use English headers and promo titles — language-neutral data blocks. */
export function isLanguageNeutralAssistantBlock(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) {
		return false;
	}
	const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) {
		return false;
	}
	return lines.every((line) => /^\|.+\|$/.test(line));
}

/**
 * Returns true when the assistant reply matches the required customer language.
 */
export function assistantReplyMatchesLanguage(reply: string, required: CustomerMessageLanguage): boolean {
	const trimmed = reply.trim();
	if (!trimmed) {
		return false;
	}
	if (isLanguageNeutralAssistantBlock(trimmed)) {
		return true;
	}

	const romanCount = countRomanUrduMarkers(trimmed);
	const hasScript = containsUrduScript(trimmed);

	if (required === "english") {
		return romanCount < 2 && !hasScript;
	}

	if (required === "roman_urdu") {
		if (CORPORATE_ENGLISH_PATTERN.test(trimmed) && romanCount === 0) {
			return false;
		}
		return romanCount >= 1 || hasScript;
	}

	// Urdu script: prefer script; accept Roman Urdu if model cannot render script.
	return hasScript || romanCount >= 1;
}

/** Injected at the top of the system prompt every turn — hardest language lock. */
export function buildLanguageLockBlock(required: CustomerMessageLanguage): string {
	if (required === "english") {
		return [
			"LANGUAGE LOCK (mandatory — breaking this is a failed reply):",
			"The customer's LATEST message is ENGLISH. Reply 100% in English only.",
			"Do NOT use Roman Urdu (no hai, hain, acha, bhai, karun, dekho, mein, kya, ji, etc.) unless quoting the customer's exact words.",
			"Use natural Pakistani English — warm dealer tone, not corporate support script.",
			"",
		].join("\n");
	}
	if (required === "roman_urdu") {
		return [
			"LANGUAGE LOCK (mandatory — breaking this is a failed reply):",
			"The customer's LATEST message is ROMAN URDU. Reply in Roman Urdu only — same chat style (sir/bhai when natural).",
			"Do NOT reply in formal English paragraphs. Product names and Rs prices stay as-is.",
			"",
		].join("\n");
	}
	return [
		"LANGUAGE LOCK (mandatory — breaking this is a failed reply):",
		"The customer's LATEST message uses Urdu script. Reply in Urdu script when you can; Roman Urdu is acceptable if you cannot render Urdu script.",
		"Do NOT reply in English only.",
		"",
	].join("\n");
}

/** One-shot retry instruction appended after a language breach. */
export function buildLanguageRetryInstruction(required: CustomerMessageLanguage): string {
	if (required === "english") {
		return "Your last reply used the wrong language. Rewrite the FULL answer in English only. Same facts, same products and prices, no Roman Urdu.";
	}
	if (required === "roman_urdu") {
		return "Your last reply used the wrong language. Rewrite the FULL answer in Roman Urdu only. Same facts, same products and prices.";
	}
	return "Your last reply used the wrong language. Rewrite the FULL answer in Urdu script or Roman Urdu — not English.";
}
