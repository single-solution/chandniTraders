/**
 * Convert a free-form label/name into a URL-safe slug.
 *
 * This is the canonical implementation used everywhere:
 *   - DB model pre-save hooks (Category, Brand, Grade, Attribute, Product, Offer)
 *   - Admin API route handlers when assigning slugs from user input
 *   - Storefront URL synthesis
 *
 * Rules:
 *   - lowercases
 *   - strips diacritics (NFKD + combining-mark removal)
 *   - collapses runs of non-alphanumerics into a single `-`
 *   - trims leading / trailing `-`
 *   - caps length at `maxLength` so it stays index-friendly
 *
 * Always deterministic. Idempotent — `slugify(slugify(x)) === slugify(x)`.
 */
export function slugify(input: string, maxLength = 64): string {
	return input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength);
}
