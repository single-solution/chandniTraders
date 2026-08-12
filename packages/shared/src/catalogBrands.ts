/**
 * Canonical manufacturer brands for Chandni Traders (from WooCommerce product_brand).
 * Logo URLs match the live store's brand taxonomy images.
 */

export interface CatalogBrandDefinition {
	slug: string;
	name: string;
	logoUrl: string;
}

export const CATALOG_BRAND_DEFINITIONS: CatalogBrandDefinition[] = [];

export function brandInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function catalogBrandLogoUrl(_slug: string): string | undefined {
	return undefined;
}

export function isCanonicalBrandSlug(_slug: string): boolean {
	return true;
}

export const CANONICAL_BRAND_SLUGS: string[] = [];
