/**
 * Structured content for customer-facing long text on categories, grades, and offers.
 *
 * Why structured, not raw HTML?
 *   - Multiple surfaces need different density without an HTML sanitizer.
 *   - SEO meta description must come from a plain string, not markup.
 *   - Icons are first-class data on every bullet row.
 *
 * When `content` is absent, serializers pass the plain `description` or `notes` field
 * as the summary fallback.
 */

import { DEFAULT_ICON, normalizeIconName, type IconName, type IconNode } from "./icons";

/** Default lucide icon for structured-content bullets when none is chosen. */
export const STRUCTURED_CONTENT_DEFAULT_BULLET_ICON: IconName = "ShieldCheck";

/** Maximum number of bullets the editor and renderers allow. */
export const STRUCTURED_CONTENT_MAX_BULLETS = 8;

/** Per-bullet text limit — short enough for cards, generous for landings. */
export const STRUCTURED_CONTENT_BULLET_MAX_LENGTH = 140;

/** Summary character limit shared by category/offer/grade short copy. */
export const STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH = 400;

export interface StructuredContentBullet {
	text: string;
	icon: IconName;
	/**
	 * Render-only lucide geometry for `icon`, resolved server-side by the
	 * storefront serializers so clients draw the bullet icon with no
	 * registry. Never persisted; admin/storage code leaves it unset.
	 */
	iconNode?: IconNode;
}

export interface StructuredContent {
	summary: string;
	bullets: StructuredContentBullet[];
}

export function emptyStructuredContent(): StructuredContent {
	return { summary: "", bullets: [] };
}

function clampString(value: unknown, max: number): string {
	if (typeof value !== "string") {
		return "";
	}
	const trimmed = value.trim();
	if (trimmed.length <= max) {
		return trimmed;
	}
	return trimmed.slice(0, max);
}

/**
 * Coerce arbitrary input into a valid `StructuredContent`. Used at API
 * boundaries (admin POST/PUT) and at read time when serializing legacy
 * documents that may store partial data.
 */
export function normalizeStructuredContent(value: unknown, fallbackSummary = ""): StructuredContent {
	const fallback = clampString(fallbackSummary, STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH);
	if (!value || typeof value !== "object") {
		return { summary: fallback, bullets: [] };
	}
	const candidate = value as { summary?: unknown; bullets?: unknown };
	const summary = clampString(candidate.summary, STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH) || fallback;
	const rawBullets = Array.isArray(candidate.bullets) ? candidate.bullets : [];
	const bullets: StructuredContentBullet[] = [];
	for (const entry of rawBullets) {
		if (bullets.length >= STRUCTURED_CONTENT_MAX_BULLETS) {
			break;
		}
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const text = clampString((entry as { text?: unknown }).text, STRUCTURED_CONTENT_BULLET_MAX_LENGTH);
		if (!text) {
			continue;
		}
		const icon = normalizeIconName((entry as { icon?: unknown }).icon, STRUCTURED_CONTENT_DEFAULT_BULLET_ICON);
		bullets.push({ text, icon });
	}
	return { summary, bullets };
}

/**
 * `true` when the payload would render any visible content (summary or
 * at least one bullet). Used by surface renderers to decide whether to
 * show the wrapper at all.
 */
export function hasStructuredContent(value: StructuredContent | null | undefined): boolean {
	if (!value) return false;
	return Boolean(value.summary) || value.bullets.length > 0;
}
