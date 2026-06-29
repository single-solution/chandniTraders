import { connectDB } from "./connection";
import { Offer } from "./models";

function usageLimitFilter() {
	return {
		$or: [
			{ "constraints.usageLimit": { $exists: false } },
			{ "constraints.usageLimit": null },
			{ "constraints.usageLimit": { $lte: 0 } },
			{ $expr: { $lt: ["$constraints.usageCount", "$constraints.usageLimit"] } },
		],
	};
}

/** Atomically reserve one redemption per offer — returns false if any limit is exhausted. */
export async function incrementOfferUsageCounts(offerIds: string[]): Promise<boolean> {
	const uniqueIds = [...new Set(offerIds.map((id) => id.trim()).filter(Boolean))];
	if (!uniqueIds.length) {
		return true;
	}

	await connectDB();

	for (const offerId of uniqueIds) {
		const updated = await Offer.findOneAndUpdate(
			{
				_id: offerId,
				isActive: true,
				...usageLimitFilter(),
			},
			{ $inc: { "constraints.usageCount": 1 } },
		).lean();
		if (!updated) {
			return false;
		}
	}

	return true;
}

/** Roll back usage reservation when order placement fails after increment. */
export async function decrementOfferUsageCounts(offerIds: string[]): Promise<void> {
	const uniqueIds = [...new Set(offerIds.map((id) => id.trim()).filter(Boolean))];
	if (!uniqueIds.length) {
		return;
	}

	await connectDB();
	await Offer.updateMany({ _id: { $in: uniqueIds }, "constraints.usageCount": { $gt: 0 } }, { $inc: { "constraints.usageCount": -1 } });
}
