import { NextResponse } from "next/server";

import { Offer as OfferModel, connectDB } from "@store/db";
import { badRequest, isOfferEligible, isValidId, serverError, toActiveOffer } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";

const MAX_RESOLVE_IDS = 20;
const OFFERS_RESOLVE_PER_MINUTE = 60;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-offers-resolve",
		max: OFFERS_RESOLVE_PER_MINUTE,
		windowMs: 60_000,
	});
	if (limited) {
		return limited;
	}

	const idsParam = new URL(request.url).searchParams.get("ids")?.trim();
	if (!idsParam) {
		return badRequest("ids query parameter is required.");
	}

	const ids = idsParam
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (ids.length === 0) {
		return badRequest("At least one offer id is required.");
	}
	if (ids.length > MAX_RESOLVE_IDS) {
		return badRequest(`Cannot resolve more than ${MAX_RESOLVE_IDS} offers at once.`);
	}
	if (ids.some((id) => !isValidId(id))) {
		return badRequest("One or more offer ids are invalid.");
	}

	try {
		await connectDB();
		const docs = await OfferModel.find({ _id: { $in: ids }, isActive: true }).lean();
		const offers = docs.map((doc) => toActiveOffer(doc)).filter((offer) => isOfferEligible(offer));
		return NextResponse.json(offers);
	} catch {
		return serverError("An unexpected error occurred");
	}
}
