/**
 * Internal storefront paths the chat assistant may link to.
 * Product URLs are `/{category}/{slug}` — not under `/shop`.
 */

const BLOCKED_ROOT_SEGMENTS = new Set(["api"]);

function pathSegments(path: string): string[] {
	const pathname = path.trim().split("?")[0] ?? "";
	return pathname.split("/").filter(Boolean);
}

function isSlugSegment(segment: string): boolean {
	return /^[\w-]+$/.test(segment);
}

/** True for customer-facing relative paths the assistant may share in chat. */
export function isInternalStorefrontPath(path: string): boolean {
	const trimmed = path.trim();
	if (!trimmed.startsWith("/") || trimmed.includes("://")) {
		return false;
	}

	const segments = pathSegments(trimmed);
	if (segments.length === 0) {
		return true;
	}

	const first = segments[0]?.toLowerCase() ?? "";
	if (BLOCKED_ROOT_SEGMENTS.has(first)) {
		return false;
	}

	if (first === "deals" && segments.length === 1) {
		return true;
	}
	if (first === "cart" && segments.length === 1) {
		return true;
	}
	if (first === "about" && segments.length === 1) {
		return true;
	}
	if (first === "checkout" && segments.length === 1) {
		return true;
	}
	if (first === "checkout" && segments.length === 2 && segments[1] === "success") {
		return true;
	}
	if (first === "account" && segments.every(isSlugSegment)) {
		return true;
	}

	// Category browse (`/ceiling-fans`) or product PDP (`/ceiling-fans/royal-deluxe`).
	if (segments.length === 1 || segments.length === 2) {
		return segments.every(isSlugSegment);
	}

	return false;
}
