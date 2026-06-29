import { NextResponse } from "next/server";
import { Offer as OfferModel, connectDB } from "@store/db";
import { isOfferActiveSchedule, serverError, toActiveOffer } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";

const OFFERS_PER_MINUTE = 60;

export async function GET(request: Request) {
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-offers",
		max: OFFERS_PER_MINUTE,
		windowMs: 60_000,
	});
	if (limited) {
		return limited;
	}

	try {
		await connectDB();

		const docs = await OfferModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
		const offers = docs.map((doc) => toActiveOffer(doc));
		const now = new Date();
		const activeOffers = offers.filter((offer) => isOfferActiveSchedule(offer.schedule, now));

		return NextResponse.json(activeOffers, {
			headers: {
				"Cache-Control": "no-store",
			},
		});
	} catch {
		return serverError("An unexpected error occurred");
	}
}
