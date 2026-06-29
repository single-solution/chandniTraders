/**
 * Storefront read caching, layered correctly.
 *
 * Two distinct cache tiers — both used here, doing different jobs:
 *
 *   1. React `cache()` — dedupes calls within a **single render**. If
 *      `generateMetadata` and the page body both ask for the same category
 *      lookup, only one underlying call happens.
 *
 *   2. Next.js `unstable_cache` — dedupes across **HTTP requests** for a
 *      given time window. Storefront reads are stable enough that a
 *      60-second window costs ~zero freshness but saves a Mongo round-trip
 *      on every visit. Tag-invalidate via `STOREFRONT_CACHE_TAG` from admin
 *      mutations when we need instant propagation.
 *
 * RSC pages / layouts / metadata generators must consume these wrappers
 * instead of the raw helpers, otherwise we leak work onto the hot path.
 */
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { Brand as BrandModel, connectDB, getIntegrationSettings as getIntegrationSettingsRaw, getStoreSettings as getStoreSettingsRaw, Product as ProductModel } from "@store/db";
import type { Product } from "@store/shared";

import {
	PUBLIC_PRODUCT_FILTER,
	applyCatalogVisibility,
	resolveCatalogVisibility,
	getBrandBySlug as getBrandBySlugRaw,
	getBrands as getBrandsRaw,
	getAttributes as getAttributesRaw,
	getCategories as getCategoriesRaw,
	getCategoryMetaBySlug as getCategoryMetaBySlugRaw,
	getOffers as getOffersRaw,
	getActiveOffers as getActiveOffersRaw,
	getCatalogDeals as getCatalogDealsRaw,
	getPopularProducts as getPopularProductsRaw,
	getProductBySlug as getProductBySlugRaw,
	getProducts as getProductsRaw,
	getProductsPage as getProductsPageRaw,
	hasAnyProducts as hasAnyProductsRaw,
	searchCatalog as searchCatalogRaw,
	type ProductFilters,
	type ProductPage,
} from "@/lib/core/queries";
import { getFacets as getFacetsRaw } from "@/lib/core/facets";
import type { AttributeFacet } from "@/lib/core/facets";

/** Tag for filter-independent storefront reads. Admin mutations that should
 *  surface immediately (product save, brand toggle, category reorder) can
 *  call `revalidateTag(STOREFRONT_CACHE_TAG)` to flush this layer. */
export const STOREFRONT_CACHE_TAG = "storefront";

/** Seconds the cross-request layer holds onto storefront reads. */
const STOREFRONT_CACHE_TTL_SECONDS = 60;

/* ─────────── two-tier dedupe (unstable_cache + React cache) ─────────── */

const loadStoreSettings = unstable_cache(() => getStoreSettingsRaw(), ["storefront-settings"], { revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] });

const loadIntegrationSettings = unstable_cache(() => getIntegrationSettingsRaw(), ["storefront-integration-settings"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

/** Cross-request (60s) + per-render dedupe — settings power the root layout. */
export const getStoreSettingsCached = cache(loadStoreSettings);

/** Cross-request (60s) + per-render dedupe — card-checkout flag in layout. */
export const getIntegrationSettingsCached = cache(loadIntegrationSettings);

const loadCategoryMetaBySlug = unstable_cache((slug: string) => getCategoryMetaBySlugRaw(slug), ["storefront-category-by-slug"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

/** Cross-request (30s, tag-busted on admin edit) + per-render dedupe.
 *  Powers the category meta on `/shop/[category]` and the PDP shell. */
export const getCategoryBySlugCached = cache(loadCategoryMetaBySlug);

const loadProductBySlug = unstable_cache((slug: string) => getProductBySlugRaw(slug), ["storefront-product-by-slug"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

/**
 * Cross-request cached product shell. Pricing/stock on `variants[]` here
 * may be up to `STOREFRONT_CACHE_TTL_SECONDS` stale — the PDP overlays
 * fresh per-variant commerce from `getProductLiveCommerce`
 * inside a Suspense boundary, so the shell is fine to cache.
 *
 * Admin product/variant mutations call `bustAdminCaches()`, which flushes
 * the `storefront` tag so the next render fetches a fresh shell.
 */
export const getProductBySlugCached = cache(loadProductBySlug);

const loadBrandBySlug = unstable_cache((slug: string, categorySlug: string) => getBrandBySlugRaw(slug, categorySlug), ["storefront-brand-by-slug"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

/** Cross-request (30s, tag-busted on admin edit) + per-render dedupe. */
export const getBrandBySlugCached = cache(loadBrandBySlug);

/* ─────────── cross-request dedupe (Next.js unstable_cache) ─────────── */

export const hasAnyProductsCached = unstable_cache(() => hasAnyProductsRaw(), ["storefront-has-any-products"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

export const getCategoriesCached = unstable_cache(() => getCategoriesRaw(), ["storefront-categories"], { revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] });

export const getAttributesCached = unstable_cache(() => getAttributesRaw(), ["storefront-attributes"], { revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] });

export const getBrandsCached = unstable_cache((categorySlug?: string) => getBrandsRaw(categorySlug), ["storefront-brands-v2"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

export const getOffersCached = unstable_cache(() => getOffersRaw(), ["storefront-offers"], { revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] });

export const getActiveOffersCached = unstable_cache(() => getActiveOffersRaw(), ["storefront-active-offers"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

export const getCatalogDealsCached = unstable_cache(() => getCatalogDealsRaw(), ["storefront-catalog-deals"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

/**
 * Homepage hero — the most recently updated in-stock products across
 * every active category. Sorting by `updatedAt` (Mongoose timestamps)
 * means a restock bumps the SKU back into the hero without flipping
 * any curated flag.
 */
const getHomeHeroProductsInner = unstable_cache(
	async (limit: number): Promise<Product[]> => {
		return getProductsRaw({
			sort: "recently-updated",
			inStockOnly: true,
			limit,
		});
	},
	["storefront-hero-products-v6"],
	{ revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export function getHomeHeroProductsCached(limit: number): Promise<Product[]> {
	return getHomeHeroProductsInner(limit);
}

/**
 * Shop category banner — in-stock products from every active category
 * except the one the customer is browsing.
 */
const getShopHeroProductsInner = unstable_cache(
	async (limit: number, excludeCategorySlug: string): Promise<Product[]> => {
		const categories = await getCategoriesRaw();
		const otherCategorySlugs = categories.filter((category) => category.isActive && category.slug !== excludeCategorySlug).map((category) => category.slug);

		if (otherCategorySlugs.length === 0) {
			return [];
		}

		return getProductsRaw({
			sort: "recently-updated",
			inStockOnly: true,
			limit,
			categorySlugs: otherCategorySlugs,
		});
	},
	["storefront-shop-hero-products-v1"],
	{ revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export function getShopHeroProductsCached(limit: number, excludeCategorySlug: string): Promise<Product[]> {
	return getShopHeroProductsInner(limit, excludeCategorySlug);
}

/**
 * Cached `getProductsPage` — the heavy aggregation that powers
 * `/shop/[category]`. We key by a canonical serialization of the filter
 * object so two identical requests (same category + same query string)
 * share a single Mongo round-trip within the 30s window.
 *
 * Note: the underlying aggregation is the same whether or not we wrap it
 * — the win is in **dropping the call entirely** for cached hits.
 */
const getProductsPageInner = unstable_cache(
	async (cacheKey: string): Promise<ProductPage> => {
		const filters = JSON.parse(cacheKey) as ProductFilters;
		return getProductsPageRaw(filters);
	},
	["storefront-products-page-v2"],
	{ revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

const SITEMAP_PRODUCT_LIMIT = 5_000;

const loadSitemapProductsInner = unstable_cache(
	async () => {
		await connectDB();
		const filter: Record<string, unknown> = { ...PUBLIC_PRODUCT_FILTER };
		applyCatalogVisibility(filter, await resolveCatalogVisibility());
		return ProductModel.find(filter)
			.select({ slug: 1, categorySlug: 1, updatedAt: 1 })
			.sort({ updatedAt: -1 })
			.limit(SITEMAP_PRODUCT_LIMIT)
			.lean<Array<{ slug: string; categorySlug: string; updatedAt?: Date }>>();
	},
	["storefront-sitemap-products"],
	{ revalidate: 3600, tags: [STOREFRONT_CACHE_TAG] },
);

export function getSitemapProductsCached() {
	return loadSitemapProductsInner();
}

const loadSitemapBrandsInner = unstable_cache(
	async () => {
		await connectDB();
		return BrandModel.find({ isActive: true }).select({ slug: 1 }).lean<Array<{ slug: string }>>();
	},
	["storefront-sitemap-brands"],
	{ revalidate: 3600, tags: [STOREFRONT_CACHE_TAG] },
);

export function getSitemapBrandsCached() {
	return loadSitemapBrandsInner();
}

export function getProductsPageCached(filters: ProductFilters): Promise<ProductPage> {
	return getProductsPageInner(stableFilterKey(filters));
}

/**
 * Cross-request cached facets — the filter sidebar's attribute aggregation.
 * Keyed by the same canonical filter serialization as the products page so a
 * `/shop/[category]` listing and its `/api/facets` companion (identical
 * filters) share one Atlas round-trip within the 30s window. Tag-busted on
 * any admin catalog mutation via `bustAdminCaches()`.
 */
const getFacetsInner = unstable_cache(
	async (cacheKey: string): Promise<AttributeFacet[]> => {
		return getFacetsRaw(JSON.parse(cacheKey) as ProductFilters);
	},
	["storefront-facets-v1"],
	{ revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export function getFacetsCached(filters: ProductFilters): Promise<AttributeFacet[]> {
	return getFacetsInner(stableFilterKey(filters));
}

/** Sort keys for a stable cache identity regardless of insertion order. */
function stableFilterKey(filters: ProductFilters): string {
	const stable = Object.keys(filters)
		.sort()
		.reduce<Record<string, unknown>>((acc, key) => {
			const value = (filters as Record<string, unknown>)[key];
			if (value !== undefined) {
				acc[key] = value;
			}
			return acc;
		}, {});
	return JSON.stringify(stable);
}

/**
 * Cross-request cached relevance search for the chat assistant. Same 30s
 * window + tag invalidation as the rest of the storefront reads, so repeated
 * "royal deluxe" lookups in a busy chat hour share one Atlas round-trip.
 */
const searchAssistantCatalogInner = unstable_cache(
	async (cacheKey: string): Promise<Product[]> => {
		return searchCatalogRaw(JSON.parse(cacheKey) as ProductFilters);
	},
	["assistant-catalog-search-v1"],
	{ revalidate: STOREFRONT_CACHE_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export function searchAssistantCatalogCached(filters: ProductFilters): Promise<Product[]> {
	return searchAssistantCatalogInner(stableFilterKey(filters));
}

/**
 * Cross-request cached best-sellers (derived from order history). Public
 * product summaries only — used by the assistant's `get_top_products` tool.
 */
const getPopularProductsInner = unstable_cache(async (limit: number): Promise<Product[]> => getPopularProductsRaw(limit), ["assistant-popular-products-v1"], {
	revalidate: STOREFRONT_CACHE_TTL_SECONDS,
	tags: [STOREFRONT_CACHE_TAG],
});

export function getPopularProductsCached(limit: number): Promise<Product[]> {
	return getPopularProductsInner(limit);
}

const HOME_HERO_WARM_LIMIT = 12;
const CATEGORY_WARM_LIMIT = 4;
const CATEGORY_LISTING_WARM_PAGE_SIZE = 24;

/**
 * Prime Mongo for the paths every cold visit hits.
 * Uses raw queries only — `unstable_cache` is unavailable during instrumentation boot.
 * Safe to fire-and-forget at server boot — failures are logged, never thrown.
 */
export async function warmStorefrontReadCaches(): Promise<void> {
	const { logger } = await import("@store/shared");

	// Dev skips the warm pass — it fans out many Mongo aggregations at boot
	// while Turbopack is still compiling, doubling CPU/RAM for little gain.
	// Set WARM_STOREFRONT_CACHES=true to opt in locally.
	if (process.env.NODE_ENV !== "production" && process.env.WARM_STOREFRONT_CACHES !== "true") {
		return;
	}

	try {
		await connectDB();

		const [categories] = await Promise.all([
			getCategoriesRaw(),
			getStoreSettingsRaw(),
			getIntegrationSettingsRaw(),
			getAttributesRaw(),
			getOffersRaw(),
			getCatalogDealsRaw(),
			hasAnyProductsRaw(),
			getProductsRaw({
				sort: "recently-updated",
				inStockOnly: true,
				limit: HOME_HERO_WARM_LIMIT,
			}),
		]);

		const activeCategories = categories.filter((category) => category.isActive).slice(0, CATEGORY_WARM_LIMIT);
		await Promise.all(
			activeCategories.map(async (category) => {
				await getCategoryMetaBySlugRaw(category.slug);
				await getProductsPageRaw({
					categorySlug: category.slug,
					page: 1,
					limit: CATEGORY_LISTING_WARM_PAGE_SIZE,
					sort: "recently-updated",
				});
			}),
		);
	} catch (error) {
		const errorDetail =
			error instanceof Error
				? { name: error.name, message: error.message }
				: { message: String(error) };
		logger.warn({ error: errorDetail }, "Storefront cache warm skipped");
	}
}
