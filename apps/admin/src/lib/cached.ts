/**
 * Admin-app read caching.
 *
 * Admin pages are far less hot than the storefront (one operator per
 * tenant vs many concurrent visitors), but the dashboard alone fires
 * ~18 parallel Mongo round-trips, and list pages re-fetch the whole
 * catalog on every navigation. A short 30s cross-request cache makes
 * navigation between admin pages feel instant without compromising
 * freshness — every mutation route handler calls
 * `revalidateTag(ADMIN_CACHE_TAG)` to bust the layer immediately.
 *
 * Two tiers, identical to the storefront pattern:
 *
 *   1. React `cache()` — per-render dedupe. Used by lookups that
 *      `generateMetadata` and the page body both call (no metadata
 *      generators in admin today, but we set up the shape so future
 *      pages benefit automatically).
 *
 *   2. Next.js `unstable_cache` — cross-request dedupe. Used for the
 *      dashboard aggregation bundle and the catalog list reads.
 */
import { unstable_cache } from "next/cache";

import { ActivityEntry, Brand, connectDB, Customer, getStoreSettings, Inquiry, Offer, Order, ORDER_STATUSES, Product, SIGNED_IN_INQUIRY_FILTER, User } from "@store/db";
import { escapeRegex, LOYALTY_POINT_TO_RUPEE, MAX_INPUT_LENGTH } from "@store/shared";

import {
	loadDashboardDailyRevenue as loadDashboardDailyRevenueRaw,
	loadDashboardKpis as loadDashboardKpisRaw,
	loadDashboardRecentInquiries as loadDashboardRecentInquiriesRaw,
	loadPerformanceSummary as loadPerformanceSummaryRaw,
} from "@/lib/server/dashboardStats";
import type { PerformanceCompare, PerformanceRange } from "@/lib/dashboard/performancePeriod";
import { loadShopHealth as loadShopHealthRaw } from "@/lib/server/shopHealth";
import { loadProductWizardCatalog as loadProductWizardCatalogRaw, type ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";
import { toActivityResponse, type ActivityEntryLean } from "@/lib/serializers/activity";
import { type BrandLean } from "@/lib/serializers/brand";
import { summariseInquiry, type InquiryLean } from "@/lib/serializers/inquiry";
import { toOfferResponse, type OfferLean } from "@/lib/serializers/offer";
import { summariseOrder, type OrderLean } from "@/lib/serializers/order";
import { loadCustomerListCounts, loadCustomerListPage, type CustomerListParams } from "@/lib/server/customerListQuery";
import type { ListResponse } from "@/lib/api/listOptions";
import { brandLookupKey, summariseProduct, type ProductLean } from "@/lib/serializers/product";
import { toUserResponse, type UserLean } from "@/lib/serializers/user";
import type { AdminActivityEntry, AdminCustomerSummary, AdminInquirySummary, AdminOffer, AdminOrderSummary, AdminProductSummary, AdminUser } from "@/types/models";

/** Tag for admin reads. Any admin mutation that should reflect
 *  immediately should call `revalidateTag(ADMIN_CACHE_TAG)`. */
export const ADMIN_CACHE_TAG = "admin";

/** Seconds the cross-request layer holds onto admin reads. Chosen so
 *  the dashboard feels live (numbers age at most by ~half-minute)
 *  while still saving Mongo round-trips on a busy admin session. */
const ADMIN_CACHE_TTL_SECONDS = 30;

/**
 * Three independent cached loaders behind the dashboard.
 *
 * Split loaders so each dashboard section can suspend on only the aggregations it needs.
 * Any admin mutation that should reflect immediately calls `bustAdminCaches()`.
 */

export const loadDashboardKpisCached = unstable_cache(() => loadDashboardKpisRaw(), ["admin-dashboard-kpis"], { revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] });

export const loadDashboardDailyRevenueCached = unstable_cache(() => loadDashboardDailyRevenueRaw(), ["admin-dashboard-daily-revenue"], {
	revalidate: ADMIN_CACHE_TTL_SECONDS,
	tags: [ADMIN_CACHE_TAG],
});

export const loadDashboardRecentInquiriesCached = unstable_cache(() => loadDashboardRecentInquiriesRaw(), ["admin-dashboard-recent-inquiries"], {
	revalidate: ADMIN_CACHE_TTL_SECONDS,
	tags: [ADMIN_CACHE_TAG],
});

/**
 * Period-aware performance summary cache. The cache key includes the
 * range + compare arguments so each (range, compare) tuple gets its
 * own slot. Same 15s TTL as the rest of the dashboard.
 */
export const loadPerformanceSummaryCached = unstable_cache(
	async (range: PerformanceRange, compare: PerformanceCompare) => loadPerformanceSummaryRaw({ range, compare }),
	["admin-dashboard-performance-summary"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

/** Shop health card — settings + catalog hygiene + stock readiness. */
export const loadShopHealthCached = unstable_cache(() => loadShopHealthRaw(), ["admin-dashboard-shop-health"], { revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] });

import { revalidateTag } from "next/cache";

/** Tag for filter-independent storefront reads — duplicated from
 *  `apps/web/src/lib/core/cached.ts` so we can flush it from an
 *  admin mutation without cross-app importing. */
const STOREFRONT_CACHE_TAG = "storefront";

/**
 * Profile passed to `revalidateTag` in Next 16. Per Next.js docs, route
 * handlers (where we live) cannot use `updateTag` — they must call
 * `revalidateTag(tag, profile)` and `"max"` means "expire immediately
 * and revalidate on the next read", which is what we want after a
 * mutation.
 *
 * See: https://nextjs.org/docs/messages/revalidate-tag-single-arg
 */
const REVALIDATE_PROFILE = "max";

/**
 * Flush both the admin cache (dashboard, stats) and the storefront
 * cache (brand list, category list, product page) in one call.
 *
 * Call this from every mutation that changes a row a customer or
 * operator can see — products/brands/categories/orders/offers. The
 * 15s admin TTL is a worst-case safety net; this helper makes the
 * mutation feel instant to whoever just clicked "Save".
 */
export function bustAdminCaches(): void {
	revalidateTag(ADMIN_CACHE_TAG, REVALIDATE_PROFILE);
	revalidateTag(STOREFRONT_CACHE_TAG, REVALIDATE_PROFILE);
}

// ────────────────────────────────────────────────────────────────
// Admin list page loaders (cached)
//
// Every list page (products / orders / customers / inquiries / team /
// offers / activity) used to re-run its Mongo find on every visit —
// even a sidebar click already showing the data in the router cache.
// Wrapping the find + serializer in `unstable_cache` makes repeat
// admin navigation effectively free for 15s, and the existing
// `bustAdminCaches()` calls in mutation routes flush these tags
// alongside the dashboard ones.
// ────────────────────────────────────────────────────────────────

const ADMIN_PRODUCTS_LIST_LIMIT_DEFAULT = 0;
const ADMIN_ORDERS_LIST_LIMIT = 200;
const ADMIN_OFFERS_LIST_LIMIT = 200;
const ADMIN_ACTIVITY_LIST_LIMIT = 200;

const ADMIN_PRODUCT_LIST_SELECT = {
	slug: 1,
	name: 1,
	categorySlug: 1,
	brandSlug: 1,
	isFeatured: 1,
	isActive: 1,
	isArchived: 1,
	images: 1,
	variants: 1,
	seo: 1,
	createdAt: 1,
	updatedAt: 1,
} as const;

/** First-page size for the scroll-to-load-more admin workspaces (orders,
 *  customers, inquiries). Subsequent pages come from the list endpoints. */
const ADMIN_LIST_PAGE_SIZE = 24;

const ORDER_STATUS_SET = new Set<string>(ORDER_STATUSES);

export const loadAdminProductsCached = unstable_cache(
	async (): Promise<{
		products: AdminProductSummary[];
		catalog: ProductWizardCatalog;
	}> => {
		await connectDB();
		const productsQuery = Product.find({ isArchived: { $ne: true } })
			.select(ADMIN_PRODUCT_LIST_SELECT)
			.sort({ createdAt: -1 });
		if (ADMIN_PRODUCTS_LIST_LIMIT_DEFAULT > 0) {
			productsQuery.limit(ADMIN_PRODUCTS_LIST_LIMIT_DEFAULT);
		}
		const [productDocs, brandDocs, catalog, storeSettings] = await Promise.all([
			productsQuery.lean<ProductLean[]>(),
			Brand.find().lean<BrandLean[]>(),
			loadProductWizardCatalogRaw(),
			getStoreSettings(),
		]);
		const brandsByCategoryAndSlug = new Map(brandDocs.flatMap((brand) => brand.categorySlugs.map((categorySlug) => [brandLookupKey(categorySlug, brand.slug), brand] as const)));
		const storeName = storeSettings.siteName?.trim() || "Chandni Traders";
		const products = productDocs.map((doc) => summariseProduct(doc, brandsByCategoryAndSlug, storeName));
		return { products, catalog };
	},
	["admin-products-list"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminOrdersCached = unstable_cache(
	async (): Promise<AdminOrderSummary[]> => {
		await connectDB();
		const docs = await Order.find().sort({ placedAt: -1 }).limit(ADMIN_ORDERS_LIST_LIMIT).lean<OrderLean[]>();
		return docs.map(summariseOrder);
	},
	["admin-orders-list"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

/** Exposed so callers can format the customers page consistently. */
export const ADMIN_LOYALTY_POINT_TO_RUPEE = LOYALTY_POINT_TO_RUPEE;

// ── Scroll-to-load-more seeds (orders / customers / inquiries) ──────
//
// Each list workspace now server-paginates over its `/api/*` endpoint.
// The page renders the SSR first page (flash-free) via `loadAdmin*Page`
// (filter/search-aware, page size `ADMIN_LIST_PAGE_SIZE`); the sidebar
// counts/stats come from `loadAdmin*Counts`, computed over ALL records
// so they stay exact as the list pages in. `countDocuments` runs only
// for the seed and on a filter/search change — `loadMore` reuses the
// seeded total, so deeper pages never re-count.

export interface AdminOrdersCounts {
	byStatus: Record<string, number>;
	total: number;
	pending: number;
	netRevenueRupees: number;
}

export const loadAdminOrdersCounts = unstable_cache(
	async (): Promise<AdminOrdersCounts> => {
		await connectDB();
		const rows = await Order.aggregate<{ _id: string; count: number; revenue: number }>([
			{ $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totals.totalRupees" } } },
		]);
		const byStatus: Record<string, number> = {};
		let total = 0;
		let netRevenueRupees = 0;
		for (const row of rows) {
			byStatus[row._id] = row.count;
			total += row.count;
			// Net revenue mirrors the workspace: exclude cancelled + refunded.
			if (row._id !== "cancelled" && row._id !== "refunded") {
				netRevenueRupees += row.revenue;
			}
		}
		return { byStatus, total, pending: byStatus["pending-payment"] ?? 0, netRevenueRupees };
	},
	["admin-orders-counts"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminOrdersPage = unstable_cache(
	async (params: { search?: string; status?: string }): Promise<ListResponse<AdminOrderSummary>> => {
		await connectDB();
		const filter: Record<string, unknown> = {};
		const search = (params.search ?? "").trim().slice(0, MAX_INPUT_LENGTH);
		if (search) {
			const pattern = escapeRegex(search);
			filter.$or = [
				{ orderNumber: { $regex: pattern, $options: "i" } },
				{ "customerSnapshot.name": { $regex: pattern, $options: "i" } },
				{ "customerSnapshot.phoneNumber": { $regex: pattern, $options: "i" } },
				{ "customerSnapshot.city": { $regex: pattern, $options: "i" } },
			];
		}
		if (params.status && ORDER_STATUS_SET.has(params.status)) {
			filter.status = params.status;
		}
		const [docs, total] = await Promise.all([Order.find(filter).sort({ placedAt: -1 }).limit(ADMIN_LIST_PAGE_SIZE).lean<OrderLean[]>(), Order.countDocuments(filter)]);
		return { items: docs.map(summariseOrder), total, page: 1, limit: ADMIN_LIST_PAGE_SIZE };
	},
	["admin-orders-page"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminCustomersPage = unstable_cache(
	(params: CustomerListParams): Promise<ListResponse<AdminCustomerSummary>> => loadCustomerListPage({ ...params, limit: ADMIN_LIST_PAGE_SIZE }),
	["admin-customers-page"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminCustomersCounts = unstable_cache(() => loadCustomerListCounts(), ["admin-customers-counts"], {
	revalidate: ADMIN_CACHE_TTL_SECONDS,
	tags: [ADMIN_CACHE_TAG],
});

export const loadAdminInquiriesPage = unstable_cache(
	async (params: { search?: string }): Promise<ListResponse<AdminInquirySummary>> => {
		await connectDB();
		const search = (params.search ?? "").trim().slice(0, MAX_INPUT_LENGTH);
		let filter: Record<string, unknown> = SIGNED_IN_INQUIRY_FILTER;
		if (search) {
			const pattern = escapeRegex(search);
			filter = {
				$and: [
					SIGNED_IN_INQUIRY_FILTER,
					{
						$or: [
							{ customerName: { $regex: pattern, $options: "i" } },
							{ phoneNumber: { $regex: pattern, $options: "i" } },
							{ subjectProductName: { $regex: pattern, $options: "i" } },
							{ lastMessagePreview: { $regex: pattern, $options: "i" } },
						],
					},
				],
			};
		}
		const [docs, total] = await Promise.all([Inquiry.find(filter).sort({ lastMessageAt: -1 }).limit(ADMIN_LIST_PAGE_SIZE).lean<InquiryLean[]>(), Inquiry.countDocuments(filter)]);
		return { items: docs.map(summariseInquiry), total, page: 1, limit: ADMIN_LIST_PAGE_SIZE };
	},
	["admin-inquiries-page"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminTeamCached = unstable_cache(
	async (): Promise<AdminUser[]> => {
		await connectDB();
		const docs = await User.find().sort({ name: 1 }).lean<UserLean[]>();
		return docs.map(toUserResponse);
	},
	["admin-team-list"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminOffersCached = unstable_cache(
	async (): Promise<AdminOffer[]> => {
		await connectDB();
		const docs = await Offer.find().sort({ sortOrder: 1, createdAt: -1 }).limit(ADMIN_OFFERS_LIST_LIMIT).lean<OfferLean[]>();
		return docs.map(toOfferResponse);
	},
	["admin-offers-list"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const loadAdminActivityCached = unstable_cache(
	async (): Promise<AdminActivityEntry[]> => {
		await connectDB();
		const docs = await ActivityEntry.find().sort({ createdAt: -1 }).limit(ADMIN_ACTIVITY_LIST_LIMIT).lean<ActivityEntryLean[]>();
		return docs.map(toActivityResponse);
	},
	["admin-activity-list"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export interface SidebarSummaryCounts {
	ordersUnread: number;
	customersUnread: number;
	inquiriesUnread: number;
}

export const loadSidebarSummaryCached = unstable_cache(
	async (actorId: string): Promise<SidebarSummaryCounts> => {
		await connectDB();
		const [ordersUnread, customersUnread, inquiriesUnread] = await Promise.all([
			Order.countDocuments({ seenByAdminIds: { $ne: actorId } }),
			Customer.countDocuments({ seenByAdminIds: { $ne: actorId } }),
			Inquiry.countDocuments({
				...SIGNED_IN_INQUIRY_FILTER,
				unreadByTeam: { $gt: 0 },
			}),
		]);
		return { ordersUnread, customersUnread, inquiriesUnread };
	},
	["admin-sidebar-summary"],
	{ revalidate: ADMIN_CACHE_TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);
