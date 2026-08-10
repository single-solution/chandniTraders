import DOMPurify from "dompurify";

/** Max HTML length for admin-authored policy documents. */
export const POLICY_HTML_MAX_LENGTH = 20_000;
export const RICH_HTML_MAX_LENGTH = 50_000;

const POLICY_ALLOWED_TAGS = ["h2", "h3", "p", "br", "strong", "em", "ul", "ol", "li", "a", "blockquote"] as const;

export function isRichHtmlEmpty(html: string): boolean {
	if (!html || !html.trim()) return true;
	const stripped = html.replace(/<[^>]*>/g, "").trim();
	return stripped.length === 0;
}

export function sanitizeRichHtml(html: string): string {
	if (typeof window === "undefined" || !html.trim()) {
		return "";
	}
	return DOMPurify.sanitize(html);
}

/**
 * Strip unsafe markup from admin-authored return / privacy policy HTML
 * before rendering on the storefront. Sanitization needs a DOM, so it runs
 * client-side only; the sole consumer (PolicyDocumentModal) renders nothing
 * until hydrated, so the server never needs a sanitized value.
 */
export function sanitizePolicyHtml(html: string): string {
	if (typeof window === "undefined" || !html.trim()) {
		return "";
	}
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [...POLICY_ALLOWED_TAGS],
		ALLOWED_ATTR: ["href", "target", "rel"],
	});
}
