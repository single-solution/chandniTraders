import { ISO_DATE_LENGTH } from "@store/shared";
import { connectDB, Order } from "@store/db";

import { PERFORMANCE_RANGE_LABELS, type PerformanceCompare, type PerformanceRange } from "@/lib/dashboard/performancePeriod";

import { changePercent, aggregateOrderRange, type DailyRevenueRow } from "./dashboardAggregations";
import { DAYS_PER_WEEK, startOfDay, startOfMonth, startOfWeek, startOfYear } from "./dashboardDateBounds";

export interface PerformancePeriod {
	range: PerformanceRange;
	compare: PerformanceCompare;
	/** Inclusive lower bound for the current window. */
	currentStart: Date;
	/** Exclusive upper bound for the current window (now). */
	currentEnd: Date;
	/** Inclusive lower bound for the comparison window. */
	comparisonStart: Date;
	/** Exclusive upper bound for the comparison window. */
	comparisonEnd: Date;
	rangeLabel: string;
	comparisonLabel: string;
}

function shiftRangeBack(start: Date, end: Date, range: PerformanceRange): { start: Date; end: Date } {
	switch (range) {
		case "today": {
			const newEnd = new Date(start);
			const newStart = new Date(start);
			newStart.setDate(newStart.getDate() - 1);
			return { start: newStart, end: newEnd };
		}
		case "week": {
			const newStart = new Date(start);
			newStart.setDate(newStart.getDate() - DAYS_PER_WEEK);
			const newEnd = new Date(start);
			return { start: newStart, end: newEnd };
		}
		case "month": {
			const newStart = new Date(start);
			newStart.setMonth(newStart.getMonth() - 1);
			const newEnd = new Date(start);
			return { start: newStart, end: newEnd };
		}
		case "year": {
			const newStart = new Date(start);
			newStart.setFullYear(newStart.getFullYear() - 1);
			const newEnd = new Date(start);
			return { start: newStart, end: newEnd };
		}
		default: {
			const exhaustive: never = range;
			throw new Error(`Unknown range: ${exhaustive as string}`);
		}
	}
}

/**
 * Resolve the four timestamps that drive the period-aware dashboard
 * panel. Both windows are width-equal so deltas are like-for-like:
 *   - "previous": same-length window immediately preceding the current.
 *   - "last_year": same-length window shifted exactly 365 days back so
 *     month-on-month comparisons against the same shopping calendar
 *     stay honest year over year.
 */
export function resolvePerformancePeriod({ range, compare, now = new Date() }: { range: PerformanceRange; compare: PerformanceCompare; now?: Date }): PerformancePeriod {
	let currentStart: Date;
	switch (range) {
		case "today":
			currentStart = startOfDay(now);
			break;
		case "week":
			currentStart = startOfWeek(now);
			break;
		case "month":
			currentStart = startOfMonth(now);
			break;
		case "year":
			currentStart = startOfYear(now);
			break;
		default: {
			const exhaustive: never = range;
			throw new Error(`Unknown range: ${exhaustive as string}`);
		}
	}
	const currentEnd = now;

	const comparison =
		compare === "previous"
			? shiftRangeBack(currentStart, currentEnd, range)
			: (() => {
					const start = new Date(currentStart);
					start.setFullYear(start.getFullYear() - 1);
					const end = new Date(currentEnd);
					end.setFullYear(end.getFullYear() - 1);
					return { start, end };
				})();

	return {
		range,
		compare,
		currentStart,
		currentEnd,
		comparisonStart: comparison.start,
		comparisonEnd: comparison.end,
		rangeLabel: PERFORMANCE_RANGE_LABELS[range],
		comparisonLabel:
			compare === "previous"
				? range === "today"
					? "vs yesterday"
					: range === "week"
						? "vs last week"
						: range === "month"
							? "vs last month"
							: "vs last year"
				: "vs same period last year",
	};
}

export interface PerformanceSummary {
	period: PerformancePeriod;
	orders: number;
	ordersChangePercent: number;
	salesRupees: number;
	salesChangePercent: number;
	averageOrderRupees: number;
	averageOrderChangePercent: number;
	/** Daily revenue series limited to the current range — fuels the chart. */
	dailySeries: { date: string; rupees: number }[];
}

/**
 * One-call summary that drives the dashboard's period-aware panel.
 *
 * Two parallel `aggregateOrderRange` calls (current + comparison) plus
 * one daily-bucket aggregation for the chart strip. Same shape as the
 * other dashboard loaders so it can be cached identically and revalidated
 * on every mutation.
 */
export async function loadPerformanceSummary(args: { range: PerformanceRange; compare: PerformanceCompare }): Promise<PerformanceSummary> {
	await connectDB();
	const period = resolvePerformancePeriod(args);

	const [current, previous, dailyRows] = await Promise.all([
		aggregateOrderRange(period.currentStart, period.currentEnd),
		aggregateOrderRange(period.comparisonStart, period.comparisonEnd),
		Order.aggregate<DailyRevenueRow>([
			{
				$match: {
					placedAt: { $gte: period.currentStart, $lt: period.currentEnd },
				},
			},
			{
				$group: {
					_id: {
						$dateToString: { date: "$placedAt", format: "%Y-%m-%d" },
					},
					rupees: { $sum: "$totals.totalRupees" },
				},
			},
			{ $sort: { _id: 1 } },
		]),
	]);

	const averageOrderRupees = current.count > 0 ? Math.round(current.totalRupees / current.count) : 0;
	const previousAverage = previous.count > 0 ? Math.round(previous.totalRupees / previous.count) : 0;

	// Densify the daily series across the current window so the chart has a
	// point per day even when there were no orders. Only meaningful for
	// ranges spanning more than one day; for `today` we just return the
	// single day with its value (or zero).
	const dailyMap = new Map(dailyRows.map((row) => [row._id, row.rupees]));
	const dailySeries: { date: string; rupees: number }[] = [];
	const cursor = new Date(period.currentStart);
	while (cursor < period.currentEnd) {
		const key = cursor.toISOString().slice(0, ISO_DATE_LENGTH);
		dailySeries.push({ date: key, rupees: dailyMap.get(key) ?? 0 });
		cursor.setDate(cursor.getDate() + 1);
	}

	return {
		period,
		orders: current.count,
		ordersChangePercent: changePercent(current.count, previous.count),
		salesRupees: current.totalRupees,
		salesChangePercent: changePercent(current.totalRupees, previous.totalRupees),
		averageOrderRupees,
		averageOrderChangePercent: changePercent(averageOrderRupees, previousAverage),
		dailySeries,
	};
}
