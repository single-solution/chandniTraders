/**
 * Shared parser for the optional `seo` subdocument carried by Product,
 * Category, Brand and Offer write endpoints. Returns either a sanitized
 * `SeoMeta` payload (suitable for `$set: { seo: ... }`) or a Response
 * representing a 400 validation failure. Returning `undefined` means the
 * caller didn't send a `seo` block at all and the current value should
 * remain untouched.
 */

import { badRequest, isValidationError, SEO_META_FIELD_LIMITS, validateString, type SeoMeta } from "@store/shared";

interface RawSeoInput {
	title?: unknown;
	description?: unknown;
	canonicalUrl?: unknown;
	ogImageUrl?: unknown;
	focusKeyword?: unknown;
	noindex?: unknown;
	nofollow?: unknown;
}

export type SeoParseResult = { seo: SeoMeta } | { response: Response } | { skip: true };

function trimToUndef(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function parseSeoPayload(raw: unknown): SeoParseResult {
	if (raw === undefined || raw === null) {
		return { skip: true };
	}
	if (typeof raw !== "object" || Array.isArray(raw)) {
		return { response: badRequest("`seo` must be an object.") };
	}
	const input = raw as RawSeoInput;
	const result: SeoMeta = {};

	if (input.title !== undefined && input.title !== null && input.title !== "") {
		const parsed = validateString(input.title, {
			label: "SEO title",
			max: SEO_META_FIELD_LIMITS.title,
			required: false,
		});
		if (isValidationError(parsed)) {
			return { response: badRequest(parsed.error) };
		}
		result.title = parsed;
	}
	if (input.description !== undefined && input.description !== null && input.description !== "") {
		const parsed = validateString(input.description, {
			label: "SEO description",
			max: SEO_META_FIELD_LIMITS.description,
			required: false,
		});
		if (isValidationError(parsed)) {
			return { response: badRequest(parsed.error) };
		}
		result.description = parsed;
	}
	const canonical = trimToUndef(input.canonicalUrl);
	if (canonical) {
		if (canonical.length > SEO_META_FIELD_LIMITS.canonicalUrl) {
			return { response: badRequest("Canonical URL is too long.") };
		}
		result.canonicalUrl = canonical;
	}
	const ogImage = trimToUndef(input.ogImageUrl);
	if (ogImage) {
		if (ogImage.length > SEO_META_FIELD_LIMITS.ogImageUrl) {
			return { response: badRequest("OG image URL is too long.") };
		}
		result.ogImageUrl = ogImage;
	}
	const focus = trimToUndef(input.focusKeyword);
	if (focus) {
		if (focus.length > SEO_META_FIELD_LIMITS.focusKeyword) {
			return { response: badRequest("Focus keyword is too long.") };
		}
		result.focusKeyword = focus;
	}
	if (input.noindex !== undefined) {
		result.noindex = Boolean(input.noindex);
	}
	if (input.nofollow !== undefined) {
		result.nofollow = Boolean(input.nofollow);
	}

	return { seo: result };
}
