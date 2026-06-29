import { isInternalStorefrontPath } from "./storefrontPaths";

/**
 * Sanitize assistant output before it reaches customers.
 * Strips external URLs and markdown links; keeps internal storefront paths.
 */

/** Global flag: only for `.replace()`. Never call `.test()` on these (stateful lastIndex). */
const EXTERNAL_URL_REPLACE = /https?:\/\/[^\s<>"')\]]+/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Non-global twin used for `.test()` so detection is stateless across bubbles. */
const EXTERNAL_URL_TEST = /https?:\/\/[^\s<>"')\]]+/i;

/**
 * Self-disclosure phrasings that reveal the assistant is not human. If the
 * model slips one of these, the caller swaps in the safe human fallback rather
 * than sending it — the bot must always present as store support.
 */
const BOT_DISCLOSURE_PATTERN =
	/\b(?:as an ai|i(?:'m| am) (?:an? )?(?:ai|bot|chat ?bot|computer|program|language model|virtual assistant|automated|artificial)|language model|artificial intelligence|i (?:am|'m) not (?:a )?(?:human|real|a person)|i cannot.{0,20}as an ai)\b/i;

/**
 * Secrets / infrastructure the bot must NEVER emit, even if it hallucinates one
 * or is tricked into echoing config. Matches credential shapes, env-var names,
 * connection strings, and `process.env` access. A hit forces the safe fallback.
 */
const SECRET_LEAK_PATTERN =
	/(?:mongodb(?:\+srv)?:\/\/|process\.env|\b[A-Z][A-Z0-9_]*(?:API_KEY|_SECRET|SECRET_|ACCESS_TOKEN|PRIVATE_KEY|_URI|_TOKEN)\b|\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}|\bAIza[0-9A-Za-z_-]{20,}|\bBearer\s+[A-Za-z0-9._-]{16,})/;

/**
 * System-prompt / internals leakage. If the model starts quoting its own rules,
 * context headers, or "system prompt", swap in the fallback rather than exposing
 * how it works.
 */
const PROMPT_LEAK_PATTERN = /\b(?:core rules?|store context|order context|system (?:prompt|instructions)|my (?:system )?prompt)\b/i;

export function sanitizeAssistantReply(raw: string): string {
	let text = raw.trim();

	// Keep internal links as markdown so the UI renders a tappable, labelled
	// link; drop the URL from external links, keeping only their label text.
	text = text.replace(MARKDOWN_LINK_PATTERN, (_match, label: string, url: string) => {
		const trimmed = url.trim();
		return isInternalStorefrontPath(trimmed) ? `[${label}](${trimmed})` : label;
	});

	// Strip any remaining bare external URLs (internal markdown links are safe).
	text = text.replace(EXTERNAL_URL_REPLACE, "");

	// Tidy horizontal whitespace and runaway blank lines, but PRESERVE single
	// newlines so lists and short line breaks render instead of collapsing.
	text = text
		.replace(/[ \t]{2,}/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return text.slice(0, 3_500);
}

/**
 * Split a raw model reply into separate chat bubbles so the bot can text like a
 * human (a quick "checking…", then the answer). Splits ONLY on an explicit line
 * of `---` the model writes — blank lines stay inside one bubble so a single
 * answer with a short list doesn't fragment into many bubbles. Each bubble is
 * sanitised independently. Returns [] when nothing usable.
 */
export function splitAssistantReply(raw: string, maxBubbles = 5): string[] {
	return raw
		.split(/(?:^|\n)[ \t]*---[ \t]*(?=\n|$)/)
		.map((segment) => sanitizeAssistantReply(segment))
		.filter((segment) => segment.length > 0)
		.slice(0, maxBubbles);
}

export function assistantReplyLooksUnsafe(text: string): boolean {
	if (!text || text.length < 8) {
		return true;
	}
	return EXTERNAL_URL_TEST.test(text) || BOT_DISCLOSURE_PATTERN.test(text) || SECRET_LEAK_PATTERN.test(text) || PROMPT_LEAK_PATTERN.test(text);
}
