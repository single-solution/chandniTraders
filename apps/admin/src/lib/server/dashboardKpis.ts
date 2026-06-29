import { ISO_DATE_LENGTH } from "@store/shared";

import { toInquiryResponse, type InquiryLean } from "@/lib/serializers/inquiry";
import type { AdminInquiry } from "@/types/models";
import { connectDB, Customer, getStoreSettings, Inquiry, LoyaltyAccount, Order, Product, SIGNED_IN_INQUIRY_FILTER } from "@store/db";

import { changePercent, aggregateOrderRange, type DailyRevenueRow, type OrderStatusBucket } from "./dashboardAggregations";
import { DAYS_PER_WEEK, startOfDay, startOfMonth, startOfWeek } from "./dashboardDateBounds";

export interface DashboardKpis {
	ordersToday: number;
	ordersThisWeek: number;
	ordersThisMonth: number;
	salesTodayRupees: number;
	salesThisWeekRupees: number;
	salesThisMonthRupees: number;
	pendingPayments: number;
	confirmedPayments: number;
	dispatched: number;
	moneyBackClaimsThisMonth: number;
	unitsInStock: number;
	lowStockVariants: number;
	modelsListed: number;
	unitsSoldThisMonth: number;
	openInquiries: number;
	totalCustomers: number;
	loyaltyMembers: number;

	changePercents: {
		ordersToday: number;
		salesToday: number;
		ordersWeek: number;
		salesWeek: number;
		ordersMonth: number;
		salesMonth: number;
		pendingPayments: number;
		confirmedPayments: number;
		dispatched: number;
		units: number;
		lowStock: number;
		inquiries: number;
		customers: number;
		loyalty: number;
	};
}

const PENDING_STATUSES: readonly string[] = ["pending-payment"];
const CONFIRMED_STATUSES: readonly string[] = ["confirmed"];
const DISPATCHED_STATUSES: readonly string[] = ["dispatched"];

/** Width of the rolling daily-revenue series shown on the dashboard. */
const DAILY_SERIES_DAYS = 30;
/** How many of the most recent inquiries to surface in the dashboard sidebar. */
const RECENT_INQUIRIES_LIMIT = 8;
/**
 * Default low-stock alert threshold used when admin settings haven't been
 * loaded yet (or when a deploy boots before any setting has been saved).
 * The runtime value is `StoreSettings.lowStockThreshold` — the constant is
 * kept exported so unit tests and skeleton hints have a stable fallback.
 */
export const LOW_STOCK_VARIANT_THRESHOLD = 2;

async function resolveLowStockThreshold(): Promise<number> {
	try {
		const settings = await getStoreSettings();
		if (Number.isFinite(settings?.lowStockThreshold) && (settings?.lowStockThreshold ?? -1) >= 0) {
			return Math.floor(settings!.lowStockThreshold);
		}
	} catch {
		// Best-effort — never let a settings hiccup take down the dashboard.
	}
	return LOW_STOCK_VARIANT_THRESHOLD;
}

export async function loadDashboardKpis(): Promise<DashboardKpis> {
	await connectDB();
	const lowStockThreshold = await resolveLowStockThreshold();
	const now = new Date();

	const todayStart = startOfDay(now);
	const yesterdayStart = new Date(todayStart);
	yesterdayStart.setDate(yesterdayStart.getDate() - 1);

	const weekStart = startOfWeek(now);
	const lastWeekStart = new Date(weekStart);
	lastWeekStart.setDate(lastWeekStart.getDate() - DAYS_PER_WEEK);

	const monthStart = startOfMonth(now);
	const lastMonthStart = new Date(monthStart);
	lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

	const [
		todayAgg,
		yesterdayAgg,
		weekAgg,
		lastWeekAgg,
		monthAgg,
		lastMonthAgg,
		statusBuckets,
		moneyBackThisMonth,
		productAgg,
		openInquiries,
		openInquiriesLastWeek,
		customerCount,
		customerCountLastMonth,
		loyaltyCount,
		loyaltyCountLastMonth,
		unitsSoldThisMonthAgg,
	] = await Promise.all([
		aggregateOrderRange(todayStart),
		aggregateOrderRange(yesterdayStart, todayStart),
		aggregateOrderRange(weekStart),
		aggregateOrderRange(lastWeekStart, weekStart),
		aggregateOrderRange(monthStart),
		aggregateOrderRange(lastMonthStart, monthStart),
		Order.aggregate<OrderStatusBucket>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
		Order.countDocuments({ status: "refunded", placedAt: { $gte: monthStart } }),
		Product.aggregate<{
			_id: null;
			modelsListed: number;
			unitsInStock: number;
			lowStockVariants: number;
		}>([
			{ $match: { isArchived: { $ne: true } } },
			{
				$project: {
					variantsActive: {
						$filter: {
							input: "$variants",
							as: "variant",
							cond: { $ne: ["$$variant.isArchived", true] },
						},
					},
				},
			},
			{
				$project: {
					modelCount: { $literal: 1 },
					inStock: {
						$size: {
							$filter: {
								input: "$variantsActive",
								as: "variant",
								cond: { $eq: ["$$variant.isInStock", true] },
							},
						},
					},
					lowStock: {
						$size: {
							$filter: {
								input: "$variantsActive",
								as: "variant",
								cond: {
									$and: [
										{ $eq: ["$$variant.isInStock", true] },
										{
											$lte: [{ $ifNull: ["$$variant.stockCount", 0] }, lowStockThreshold],
										},
									],
								},
							},
						},
					},
				},
			},
			{
				$group: {
					_id: null,
					modelsListed: { $sum: "$modelCount" },
					unitsInStock: { $sum: "$inStock" },
					lowStockVariants: { $sum: "$lowStock" },
				},
			},
		]),
		Inquiry.countDocuments({
			...SIGNED_IN_INQUIRY_FILTER,
			status: { $in: ["open", "awaiting-customer"] },
		}),
		Inquiry.countDocuments({
			...SIGNED_IN_INQUIRY_FILTER,
			status: { $in: ["open", "awaiting-customer"] },
			createdAt: { $lt: weekStart },
		}),
		Customer.countDocuments({}),
		Customer.countDocuments({ createdAt: { $lt: monthStart } }),
		LoyaltyAccount.countDocuments({}),
		LoyaltyAccount.countDocuments({ createdAt: { $lt: monthStart } }),
		Order.aggregate<{ _id: null; units: number }>([
			{ $match: { placedAt: { $gte: monthStart } } },
			{ $unwind: "$items" },
			{
				$group: {
					_id: null,
					units: { $sum: "$items.quantity" },
				},
			},
		]),
	]);

	const statusMap = new Map<string, number>();
	for (const bucket of statusBuckets) {
		statusMap.set(bucket._id, bucket.count);
	}

	const sumStatuses = (statuses: readonly string[]) => statuses.reduce((total, status) => total + (statusMap.get(status) ?? 0), 0);

	const productStats = productAgg[0] ?? {
		_id: null,
		modelsListed: 0,
		unitsInStock: 0,
		lowStockVariants: 0,
	};

	return {
		ordersToday: todayAgg.count,
		ordersThisWeek: weekAgg.count,
		ordersThisMonth: monthAgg.count,
		salesTodayRupees: todayAgg.totalRupees,
		salesThisWeekRupees: weekAgg.totalRupees,
		salesThisMonthRupees: monthAgg.totalRupees,
		pendingPayments: sumStatuses(PENDING_STATUSES),
		confirmedPayments: sumStatuses(CONFIRMED_STATUSES),
		dispatched: sumStatuses(DISPATCHED_STATUSES),
		moneyBackClaimsThisMonth: moneyBackThisMonth,
		unitsInStock: productStats.unitsInStock,
		lowStockVariants: productStats.lowStockVariants,
		modelsListed: productStats.modelsListed,
		unitsSoldThisMonth: unitsSoldThisMonthAgg[0]?.units ?? 0,
		openInquiries,
		totalCustomers: customerCount,
		loyaltyMembers: loyaltyCount,

		changePercents: {
			ordersToday: changePercent(todayAgg.count, yesterdayAgg.count),
			salesToday: changePercent(todayAgg.totalRupees, yesterdayAgg.totalRupees),
			ordersWeek: changePercent(weekAgg.count, lastWeekAgg.count),
			salesWeek: changePercent(weekAgg.totalRupees, lastWeekAgg.totalRupees),
			ordersMonth: changePercent(monthAgg.count, lastMonthAgg.count),
			salesMonth: changePercent(monthAgg.totalRupees, lastMonthAgg.totalRupees),
			pendingPayments: 0,
			confirmedPayments: 0,
			dispatched: 0,
			units: 0,
			lowStock: 0,
			inquiries: changePercent(openInquiries, openInquiriesLastWeek),
			customers: changePercent(customerCount, customerCountLastMonth),
			loyalty: changePercent(loyaltyCount, loyaltyCountLastMonth),
		},
	};
}

/**
 * Daily revenue series. Single Mongo aggregation — cached and consumed
 * independently of KPIs so the desktop sparklines can show as soon as
 * the trailing 12 days are ready, even if the heavier KPI aggregations
 * are still in flight.
 */
export async function loadDashboardDailyRevenue(): Promise<{ date: string; rupees: number }[]> {
	await connectDB();
	const now = new Date();
	const todayStart = startOfDay(now);
	const dailySeriesStart = new Date(todayStart);
	dailySeriesStart.setDate(dailySeriesStart.getDate() - (DAILY_SERIES_DAYS - 1));

	const dailyRevenueRows = await Order.aggregate<DailyRevenueRow>([
		{ $match: { placedAt: { $gte: dailySeriesStart } } },
		{
			$group: {
				_id: {
					$dateToString: { date: "$placedAt", format: "%Y-%m-%d" },
				},
				rupees: { $sum: "$totals.totalRupees" },
			},
		},
		{ $sort: { _id: 1 } },
	]);

	const dailyRevenue: { date: string; rupees: number }[] = [];
	const dailyMap = new Map(dailyRevenueRows.map((row) => [row._id, row.rupees]));
	for (let i = 0; i < DAILY_SERIES_DAYS; i += 1) {
		const date = new Date(dailySeriesStart);
		date.setDate(date.getDate() + i);
		const key = date.toISOString().slice(0, ISO_DATE_LENGTH);
		dailyRevenue.push({ date: key, rupees: dailyMap.get(key) ?? 0 });
	}
	return dailyRevenue;
}

/**
 * Recent inquiries — single indexed lookup, lightest of the three
 * dashboard reads. Cached and consumed on its own so the mobile
 * "Recent inquiries" list can render the instant the rows land.
 */
export async function loadDashboardRecentInquiries(): Promise<AdminInquiry[]> {
	await connectDB();
	const docs = await Inquiry.find(SIGNED_IN_INQUIRY_FILTER).sort({ lastMessageAt: -1 }).limit(RECENT_INQUIRIES_LIMIT).lean<InquiryLean[]>();
	return docs.map((doc) => toInquiryResponse(doc));
}
