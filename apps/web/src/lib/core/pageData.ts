/**
 * Page-level data loaders.
 *
 * The homepage renders multiple independently-streaming sections via
 * Suspense, so we expose one loader per section instead of a single
 * bundled "everything the homepage needs" function. Each loader awaits
 * only the data its section actually consumes:
 *
 *   - Hero: featured products → `getHomeHeroData`
 *   - Category tiles          → `loadHomeCategoryTiles`
 *
 * Process and visit-store sections only need `getStoreSettingsCached`,
 * which they call directly.
 *
 * All reads still go through `cached.ts` — `unstable_cache` (30s TTL,
 * tagged) for cross-request dedupe so a hot homepage doesn't replay
 * Mongo round-trips per visitor.
 */

import { logger } from "@store/shared";

import type { CategoryMeta } from "@/lib/core";
import { getHomeHeroProductsCached, getShopHeroProductsCached, getCategoriesCached } from "@/lib/core/cached";
import type { Product, StructuredContent } from "@store/shared";

/**
 * Number of products fed to the hero name band. Fixed (not admin-configurable)
 * — the hero only shows product names, not images, so there is nothing
 * meaningful for an operator to tune from a settings panel.
 */
const HERO_PRODUCTS_LIMIT = 12;

export interface HomeHeroData {
	/** Latest in-stock products feeding the hero name band. */
	heroProducts: Product[];
}

export interface HomePageCategory {
	/** Stable URL slug. */
	slug: string;
	label: string;
	description: string;
	icon: CategoryMeta["icon"];
	iconNode: CategoryMeta["iconNode"];
	isActive: boolean;
	sortOrder: number;
	/** Optional admin-authored structured copy (summary + bullet rows). */
	content?: StructuredContent;
}

/**
 * Hero-section data. Single cached read — the section unblocks the
 * instant the hero products land, independent of every other homepage
 * section.
 *
 * Build-time resilience: if Mongo is unreachable (e.g. during a Vercel
 * build with a misconfigured Atlas allowlist), we return empty arrays
 * so the page still prerenders. ISR (`revalidate: 30`) means the first
 * request after deploy will retry the read and populate the cache, so
 * the degradation lasts at most one render cycle.
 */
export async function getHomeHeroData(): Promise<HomeHeroData> {
	try {
		const heroProducts = await getHomeHeroProductsCached(HERO_PRODUCTS_LIMIT);
		return { heroProducts };
	} catch (error) {
		logger.error({ error }, "home: hero data load failed, falling back to empty hero this render");
		return { heroProducts: [] };
	}
}

/**
 * Shop category banner — flank animation uses products from other categories
 * so the active listing is not repeated in the hero band.
 */
export async function getShopHeroData(excludeCategorySlug: string): Promise<HomeHeroData> {
	try {
		const heroProducts = await getShopHeroProductsCached(HERO_PRODUCTS_LIMIT, excludeCategorySlug);
		return { heroProducts };
	} catch (error) {
		logger.error({ error, excludeCategorySlug }, "shop: hero data load failed, falling back to empty hero this render");
		return { heroProducts: [] };
	}
}

/**
 * Shop-categories section data. Single cached read.
 *
 * Build-time resilience: same contract as `getHomeHeroData` — empty
 * array on read failure so the page still prerenders.
 */
export async function loadHomeCategoryTiles(): Promise<HomePageCategory[]> {
	try {
		const liveCategories = await getCategoriesCached();
		return liveCategories
			.filter((category) => category.isActive)
			.map((category) => ({
				slug: category.slug,
				label: category.label,
				description: category.description,
				icon: category.icon,
				iconNode: category.iconNode,
				isActive: category.isActive,
				sortOrder: category.sortOrder,
				content: category.content,
			}));
	} catch (error) {
		logger.error({ error }, "home: category tiles load failed, falling back to empty list this render");
		return [];
	}
}
