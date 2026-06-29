import { Order } from "@store/db";

import { PERCENT_DENOMINATOR } from "./dashboardDateBounds";

interface RangeAgg {
	count: number;
	totalRupees: number;
}

export interface OrderStatusBucket {
	_id: string;
	count: number;
}

export interface DailyRevenueRow {
	_id: string;
	rupees: number;
}

interface RangeRow {
	_id: null;
	count: number;
	totalRupees: number;
}

export async function aggregateOrderRange(start: Date, end?: Date): Promise<RangeAgg> {
	const match: Record<string, unknown> = {
		placedAt: end ? { $gte: start, $lt: end } : { $gte: start },
	};
	const rows = await Order.aggregate<RangeRow>([
		{ $match: match },
		{
			$group: {
				_id: null,
				count: { $sum: 1 },
				totalRupees: { $sum: "$totals.totalRupees" },
			},
		},
	]);
	const row = rows[0];
	return {
		count: row?.count ?? 0,
		totalRupees: row?.totalRupees ?? 0,
	};
}

export function changePercent(current: number, previous: number): number {
	if (previous <= 0) {
		return current > 0 ? PERCENT_DENOMINATOR : 0;
	}
	const change = ((current - previous) / previous) * PERCENT_DENOMINATOR;
	return Math.round(change);
}
