import type { Product, Variant } from "@store/shared";

import { selectionFromVariant } from "@/lib/catalog/pdpSelection";

/** App-router segments that must not be treated as catalog category slugs. */
export const STOREFRONT_RESERVED_SEGMENTS = new Set(["about", "account", "api", "cart", "checkout", "deals"]);

export function catalogRootHref(): string {
	return "/";
}

export function categoryHref(categorySlug: string): string {
	return `/${categorySlug}`;
}

/**
 * Build `/<categorySlug>/<slug>` with human-readable configuration params
 * (`?storage=…&colour=…`) instead of opaque variant ids.
 */
export function productHref(
	product: Pick<Product, "categorySlug" | "slug">,
	options?: {
		selection?: Record<string, string>;
		variant?: Variant;
	},
): string {
	const base = categoryHref(product.categorySlug) + `/${product.slug}`;
	const selection = options?.selection ?? (options?.variant ? selectionFromVariant(options.variant) : undefined);
	if (!selection || !hasSelectionValues(selection)) {
		return base;
	}
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(selection)) {
		if (!value) {
			continue;
		}
		params.set(key, value);
	}
	const query = params.toString();
	return query ? `${base}?${query}` : base;
}

function hasSelectionValues(selection: Record<string, string>): boolean {
	return Object.values(selection).some((value) => Boolean(value));
}

/**
 * Storefront entry URL — same as catalog root. Category rail links use
 * `categoryHref` directly.
 */
export function shopHrefFromCategories(categories: ReadonlyArray<{ slug: string; isActive: boolean }>): string {
	return firstCategoryHref(categories) ?? catalogRootHref();
}

/** First active category — use for “start shopping” CTAs, not the site home link. */
export function firstCategoryHref(categories: ReadonlyArray<{ slug: string; isActive: boolean }>): string | null {
	const firstActive = categories.find((category) => category.isActive);
	return firstActive ? categoryHref(firstActive.slug) : null;
}

export function catalogSearchHref(query: string): string {
	const params = new URLSearchParams({ q: query.trim().slice(0, 100) });
	return `/?${params.toString()}`;
}

/** True for `/<category>/<product>` paths (not reserved app routes). */
export function isProductDetailPath(pathname: string): boolean {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length < 2) {
		return false;
	}
	return !STOREFRONT_RESERVED_SEGMENTS.has(segments[0] ?? "");
}

/** Absolute PDP URL for metadata, JSON-LD, and breadcrumbs. */
export function productAbsoluteUrl(
	siteUrl: string,
	product: Pick<Product, "categorySlug" | "slug">,
	options?: {
		selection?: Record<string, string>;
		variant?: Variant;
	},
): string {
	const path = productHref(product, options);
	const origin = siteUrl.replace(/\/$/, "");
	return `${origin}${path}`;
}
