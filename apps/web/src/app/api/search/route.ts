/**
 * Public storefront search.
 *
 * GET /api/search?query=&limit=
 *
 * Returns up to `limit` (default 10) products that match `query` across
 * model name and highlights. Used by the header `SearchOverlay` for
 * type-ahead.
 *
 * Security:
 *   - Rate-limited per IP — search is cheap but easy to abuse for catalogue
 *     scraping.
 *   - Search string is regex-escaped (via the storefront query layer) so
 *     `/.*$/` style attacks are impossible.
 *   - Public visibility filter is applied — we never reveal hidden / draft
 *     products.
 */

import { DECIMAL_RADIX, logger, ok, PER_MINUTE_WINDOW_MS, serverError, type StoredImage } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { getProductsPage } from "@/lib/core";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
/** Inclusive lower bound on `?limit=` after coercion — anything below this is clamped up. */
const MIN_LIMIT = 1;
/** Search requests allowed per IP per minute. */
const SEARCHES_PER_MINUTE = 60;

interface SearchResult {
	id: string;
	slug: string;
	categorySlug: string;
	name: string;
	brandSlug: string;
	brandName: string;
	image: StoredImage | null;
	variantCount: number;
	fromPriceRupees: number;
}

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-search",
		max: SEARCHES_PER_MINUTE,
		windowMs: PER_MINUTE_WINDOW_MS,
	});
	if (limited) {
		return limited;
	}

	const url = new URL(request.url);
	const query = (url.searchParams.get("query") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
	const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", DECIMAL_RADIX);
	const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limitRaw)) : DEFAULT_LIMIT;

	if (query.length < MIN_QUERY_LENGTH) {
		return ok({ query, results: [] satisfies SearchResult[], total: 0 });
	}

	try {
		const page = await getProductsPage({
			search: query,
			limit,
			sort: "newest",
		});

		const results: SearchResult[] = page.products.map((product) => {
			const minPrice = product.variants.length ? Math.min(...product.variants.map((variant) => variant.priceRupees)) : 0;
			const heroImage = product?.images?.[0] ?? null;
			return {
				id: product.id,
				slug: product.slug,
				categorySlug: product.categorySlug,
				name: product.name,
				brandSlug: product.brandSlug,
				brandName: product.brandName,
				image: heroImage,
				variantCount: product.variants.length,
				fromPriceRupees: minPrice,
			};
		});

		return ok({ query, results, total: page.total });
	} catch (error) {
		logger.error({ error, query }, "storefront search failed");
		return serverError("Search failed. Please try again.");
	}
}
