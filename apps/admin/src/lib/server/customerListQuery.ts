/**
 * Server-side customer list query shared by the SSR seed loader
 * (`cached.ts`) and the paginated `/api/customers` endpoint, so the
 * first page and every scrolled page are built identically (same
 * filter, sort, order-stats, and loyalty join).
 *
 * `loadCustomerListCounts` powers the workspace's segment chips and the
 * loyalty total over ALL customers (not just the loaded page), so those
 * figures stay exact as the list pages in.
 */
import type { Types } from "mongoose";

import { Customer, LoyaltyAccount, Order, connectDB } from "@store/db";
import { MAX_INPUT_LENGTH, escapeRegex } from "@store/shared";

import { toCustomerResponse, type CustomerLean } from "@/lib/serializers/customer";
import type { ListResponse } from "@/lib/api/listOptions";
import type { AdminCustomerSummary } from "@/types/models";

export type CustomerSegment = "all" | "loyalty" | "active";

export interface CustomerListParams {
	search?: string;
	segment?: CustomerSegment;
	page?: number;
	limit?: number;
}

export interface CustomerListCounts {
	all: number;
	loyalty: number;
	active: number;
	totalLoyaltyBalance: number;
}

const DEFAULT_LIMIT = 24;

interface OrderStatsRow {
	_id: Types.ObjectId;
	orderCount: number;
	lifetimeSpendRupees: number;
	lastOrderAt: Date;
}

interface LoyaltyStatsRow {
	customerId: Types.ObjectId;
	balance?: number;
	lifetimeEarned?: number;
}

export async function loadCustomerListPage(params: CustomerListParams): Promise<ListResponse<AdminCustomerSummary>> {
	await connectDB();

	const page = Math.max(1, params.page ?? 1);
	const limit = params.limit ?? DEFAULT_LIMIT;
	const skip = (page - 1) * limit;
	const filter = await buildCustomerFilter(params);

	const [docs, total] = await Promise.all([Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<CustomerLean[]>(), Customer.countDocuments(filter)]);

	const items = await attachCustomerStats(docs);
	return { items, total, page, limit };
}

export async function loadCustomerListCounts(): Promise<CustomerListCounts> {
	await connectDB();

	const [all, loyalty, activeIds, loyaltyAgg] = await Promise.all([
		Customer.countDocuments({}),
		Customer.countDocuments({ isLoyaltyMember: true }),
		Order.distinct("customerId"),
		LoyaltyAccount.aggregate<{ _id: null; sum: number }>([{ $group: { _id: null, sum: { $sum: "$balance" } } }]),
	]);

	return {
		all,
		loyalty,
		active: activeIds.length,
		totalLoyaltyBalance: loyaltyAgg[0]?.sum ?? 0,
	};
}

async function buildCustomerFilter(params: CustomerListParams): Promise<Record<string, unknown>> {
	const filter: Record<string, unknown> = {};

	const search = (params.search ?? "").trim().slice(0, MAX_INPUT_LENGTH);
	if (search) {
		const pattern = escapeRegex(search);
		filter.$or = [{ name: { $regex: pattern, $options: "i" } }, { phoneNumber: { $regex: pattern, $options: "i" } }, { city: { $regex: pattern, $options: "i" } }];
	}

	if (params.segment === "loyalty") {
		filter.isLoyaltyMember = true;
	} else if (params.segment === "active") {
		// "With orders" — resolve the customer ids that actually have orders so the
		// filter runs in the query rather than over the loaded page.
		const activeIds = await Order.distinct("customerId");
		filter._id = { $in: activeIds };
	}

	return filter;
}

async function attachCustomerStats(docs: CustomerLean[]): Promise<AdminCustomerSummary[]> {
	const customerIds = docs.map((customer) => customer._id);

	const [stats, loyaltyDocs] = await Promise.all([
		Order.aggregate<OrderStatsRow>([
			{ $match: { customerId: { $in: customerIds } } },
			{
				$group: {
					_id: "$customerId",
					orderCount: { $sum: 1 },
					lifetimeSpendRupees: { $sum: "$totals.totalRupees" },
					lastOrderAt: { $max: "$placedAt" },
				},
			},
		]),
		LoyaltyAccount.find({ customerId: { $in: customerIds } })
			.select({ customerId: 1, balance: 1, lifetimeEarned: 1 })
			.lean<LoyaltyStatsRow[]>(),
	]);

	const statsMap = new Map(stats.map((stat) => [stat._id.toString(), stat]));
	const loyaltyMap = new Map(loyaltyDocs.map((account) => [account.customerId.toString(), account]));

	return docs.map((customer) => {
		const stat = statsMap.get(customer._id.toString());
		const loyalty = loyaltyMap.get(customer._id.toString());
		const full = toCustomerResponse(customer, {
			orderCount: stat?.orderCount ?? 0,
			lifetimeSpendRupees: stat?.lifetimeSpendRupees ?? 0,
			lastOrderAt: stat?.lastOrderAt,
			loyaltyBalance: loyalty?.balance ?? 0,
			loyaltyLifetimeEarned: loyalty?.lifetimeEarned ?? 0,
		});
		return {
			id: full.id,
			name: full.name,
			phoneNumber: full.phoneNumber,
			city: full.city,
			isLoyaltyMember: full.isLoyaltyMember,
			loyaltyBalance: full.loyaltyBalance,
			loyaltyLifetimeEarned: full.loyaltyLifetimeEarned,
			orderCount: full.orderCount,
			lifetimeSpendRupees: full.lifetimeSpendRupees,
			lastOrderAt: full.lastOrderAt,
			createdAt: full.createdAt,
			updatedAt: full.updatedAt,
		};
	});
}
