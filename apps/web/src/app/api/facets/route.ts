/**
 * GET /api/facets?category=<slug>&brand=...&attr.<slug>=...
 *
 * Returns attribute filter groups whose option values are derived from the
 * current product listing (hybrid facets), respecting visibility gates.
 */

import { logger, ok, serverError } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { getFacetsCached } from "@/lib/core/cached";
import { parseFiltersFromSearchParams } from "@/lib/core/filterParams";

export const dynamic = "force-dynamic";

const FACETS_PER_MINUTE = 120;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-facets",
		max: FACETS_PER_MINUTE,
		windowMs: 60_000,
	});
	if (limited) {
		return limited;
	}

	const url = new URL(request.url);
	const categorySlug = url.searchParams.get("category")?.trim();
	if (!categorySlug) {
		return ok({ facets: [] });
	}

	const filters = parseFiltersFromSearchParams(url.searchParams, {
		categorySlug,
	});

	try {
		const facets = await getFacetsCached(filters);
		return ok({ facets });
	} catch (error) {
		logger.error({ error, categorySlug }, "storefront facets failed");
		return serverError("Facets failed. Please try again.");
	}
}
