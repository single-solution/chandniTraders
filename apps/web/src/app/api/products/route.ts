/**
 * GET /api/products?category=<slug>&q=<term>&featured=1&page=<n>&limit=<n>&...
 *
 * Client-side pagination source for the infinite-scroll product feeds
 * (category listing, search results, deals). Returns the same
 * `ProductPage` shape `getProductsPage` emits so the SSR first page and
 * the client-fetched pages are byte-identical. Cached + tag-busted via
 * `getProductsPageCached`, rate-limited like `/api/facets`.
 */

import { DECIMAL_RADIX, logger, ok, serverError } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { getProductsPageCached } from "@/lib/core/cached";
import { parseFiltersFromSearchParams } from "@/lib/core/filterParams";

export const dynamic = "force-dynamic";

const PRODUCTS_PER_MINUTE = 120;
const MAX_PAGE_SIZE = 60;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-products",
		max: PRODUCTS_PER_MINUTE,
		windowMs: 60_000,
	});
	if (limited) {
		return limited;
	}

	const url = new URL(request.url);
	const searchParams = url.searchParams;

	const filters = parseFiltersFromSearchParams(searchParams, {});

	const categorySlug = searchParams.get("category")?.trim();
	if (categorySlug) {
		filters.categorySlug = categorySlug;
	}

	if (searchParams.get("featured") === "1") {
		filters.isFeatured = true;
	}

	const offerSlug = searchParams.get("offer")?.trim();
	if (offerSlug) {
		filters.offerSlug = offerSlug;
	}

	const limit = readLimit(searchParams.get("limit"));
	if (limit !== undefined) {
		filters.limit = limit;
	}

	try {
		const page = await getProductsPageCached(filters);
		return ok(page);
	} catch (error) {
		logger.error({ error }, "storefront products page failed");
		return serverError("Products failed to load. Please try again.");
	}
}

function readLimit(value: string | null): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, DECIMAL_RADIX);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}
	return Math.min(parsed, MAX_PAGE_SIZE);
}
