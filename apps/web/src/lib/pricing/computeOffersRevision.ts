import { Offer as OfferModel, connectDB } from "@store/db";

/** Revision token for client cache busting when admin publishes offer changes. */
export async function computeOffersRevision(): Promise<string> {
	await connectDB();
	const rows = await OfferModel.aggregate<{ count: number; maxUpdated: Date | null }>([
		{ $match: { isActive: true } },
		{
			$group: {
				_id: null,
				count: { $sum: 1 },
				maxUpdated: { $max: "$updatedAt" },
			},
		},
	]);
	const row = rows[0];
	const count = row?.count ?? 0;
	const maxUpdatedMs = row?.maxUpdated instanceof Date ? row.maxUpdated.getTime() : 0;
	return `${count}-${maxUpdatedMs}`;
}
