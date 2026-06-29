/**
 * Public storefront search hints.
 *
 * GET /api/search/hints
 *
 * Returns a small shuffled array of suggestion labels for the
 * `SearchOverlay` empty state — a mix of random categories, top-selling
 * products, and bottom-selling products. Each label is intended to be
 * submitted directly as a `/?q=<label>` query when the customer taps
 * the chip.
 *
 * Security:
 *   - Rate-limited per IP — hints aren't expensive but the aggregation
 *     touches Orders, Products and Categories, so we don't want it
 *     hammered by bots.
 *   - Only public / active records contribute to the pool — same
 *     visibility gates as the rest of the storefront.
 */

import { logger, ok, PER_MINUTE_WINDOW_MS, serverError } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { getSearchHints } from "@/lib/core";

export const dynamic = "force-dynamic";

const HINTS_PER_MINUTE = 60;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-search-hints",
		max: HINTS_PER_MINUTE,
		windowMs: PER_MINUTE_WINDOW_MS,
	});
	if (limited) {
		return limited;
	}

	try {
		const hints = await getSearchHints();
		return ok({ hints });
	} catch (error) {
		logger.error({ error }, "storefront search hints failed");
		return serverError("Failed to load search hints.");
	}
}
