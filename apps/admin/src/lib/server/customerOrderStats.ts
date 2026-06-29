import type { Types } from "mongoose";
import { LoyaltyAccount, Order } from "@store/db";

export interface CustomerOrderStats {
	orderCount: number;
	lifetimeSpendRupees: number;
	lastOrderAt?: Date;
	loyaltyBalance?: number;
	loyaltyLifetimeEarned?: number;
}

export async function loadCustomerOrderStats(customerId: Types.ObjectId): Promise<CustomerOrderStats> {
	const [stats, loyalty] = await Promise.all([
		Order.aggregate<{
			orderCount: number;
			lifetimeSpendRupees: number;
			lastOrderAt?: Date;
		}>([
			{ $match: { customerId } },
			{
				$group: {
					_id: null,
					orderCount: { $sum: 1 },
					lifetimeSpendRupees: { $sum: "$totals.totalRupees" },
					lastOrderAt: { $max: "$placedAt" },
				},
			},
		]),
		LoyaltyAccount.findOne({ customerId }).select({ balance: 1, lifetimeEarned: 1 }).lean<{ balance?: number; lifetimeEarned?: number } | null>(),
	]);

	const orderStats = stats[0] ?? {
		orderCount: 0,
		lifetimeSpendRupees: 0,
		lastOrderAt: undefined,
	};

	return {
		...orderStats,
		loyaltyBalance: loyalty?.balance ?? 0,
		loyaltyLifetimeEarned: loyalty?.lifetimeEarned ?? 0,
	};
}
