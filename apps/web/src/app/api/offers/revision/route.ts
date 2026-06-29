import { ok } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { computeOffersRevision } from "@/lib/pricing/computeOffersRevision";

export const dynamic = "force-dynamic";

const OFFERS_REVISION_PER_MINUTE = 120;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-offers-revision",
		max: OFFERS_REVISION_PER_MINUTE,
		windowMs: 60_000,
	});
	if (limited) {
		return limited;
	}

	const revision = await computeOffersRevision();
	return ok({ revision });
}
