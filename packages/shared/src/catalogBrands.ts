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
		logoUrl: "https://chandnitraders.pk/wp-content/uploads/2025/01/New-Project-4-1.png",
	},
	{
		slug: "sk",
		name: "SK",
		logoUrl: "https://chandnitraders.pk/wp-content/uploads/2025/01/New-Project-5.png",
	},
	{
		slug: "taimoor",
		name: "Taimoor",
		logoUrl: "https://chandnitraders.pk/wp-content/uploads/2025/01/New-Project-3.png",
	},
];

const BRAND_BY_SLUG = new Map(CATALOG_BRAND_DEFINITIONS.map((brand) => [brand.slug, brand]));

const SK_LINE_PATTERN =
	/\b(?:sk|s\.k\.?|iturbo|grace|magnum|iris|sober|nova|imperial|regency|deluxe|passion|room\s+cooler\s+sk)\b/i;

const ROYAL_LINE_PATTERN =
	/\b(?:royal|super|metal|plastic|classic|energy|executive|excutive|antique|butterfly|caroma|mystic|louver|window|eco|power\s*max|tcp|false\s*ceiling|ultra|mega|circomatic|diamond|sapphire|ovate)\b/i;

const TAIMOOR_LINE_PATTERN = /\b(?:taimoor|tamoor|penta)\b/i;

function brandDef(slug: string): { slug: string; name: string } {
	const match = BRAND_BY_SLUG.get(slug);
	return match ?? { slug: "royal", name: "Royal" };
}

export function resolveProductBrandSlug(
	productName: string,
	wooBrands?: Array<{ slug: string; name: string }>,
): { slug: string; name: string } {
	if (wooBrands?.length) {
		const wooSlug = wooBrands[0].slug.trim().toLowerCase();
		const canonical = BRAND_BY_SLUG.get(wooSlug);
		if (canonical) {
			return { slug: canonical.slug, name: canonical.name };
		}
	}

	const name = productName.replace(/\s+/g, " ").trim();

	if (TAIMOOR_LINE_PATTERN.test(name)) return brandDef("taimoor");
	if (SK_LINE_PATTERN.test(name)) return brandDef("sk");
	if (ROYAL_LINE_PATTERN.test(name) || /\broyal\b/i.test(name)) return brandDef("royal");

	return brandDef("royal");
}

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
