/**
 * Canonical manufacturer brands for Chandni Traders (from WooCommerce product_brand).
 * Logo URLs match the live store's brand taxonomy images.
 */

export interface CatalogBrandDefinition {
	slug: string;
	name: string;
	logoUrl: string;
}

/** Official brands on chandnitraders.pk — only these appear in the storefront picker. */
export const CATALOG_BRAND_DEFINITIONS: CatalogBrandDefinition[] = [
	{
		slug: "royal",
		name: "Royal",
		logoUrl: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/brands/royal/e47999ffa6/logo.webp",
	},
	{
		slug: "sk",
		name: "SK",
		logoUrl: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/brands/sk/ba9cd3861f/logo.webp",
	},
	{
		slug: "taimoor",
		name: "Taimoor",
		logoUrl: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/brands/taimoor/2dec7708a3/logo.webp",
	},
];

const BRAND_BY_SLUG = new Map(CATALOG_BRAND_DEFINITIONS.map((brand) => [brand.slug, brand]));



export function brandInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function catalogBrandLogoUrl(slug: string): string | undefined {
	return BRAND_BY_SLUG.get(slug)?.logoUrl;
}

export function isCanonicalBrandSlug(slug: string): boolean {
	return BRAND_BY_SLUG.has(slug);
}

export const CANONICAL_BRAND_SLUGS = CATALOG_BRAND_DEFINITIONS.map((brand) => brand.slug);
