/**
 * Admin "Data cleanup" endpoint — bulk-deletes a single collection at a
 * time. Used by the Settings → Cleanup tab to clear out test orders,
 * legacy inquiries, dead conversations, etc., without forcing the operator
 * to delete records one at a time.
 *
 * Hard rules:
 *   - Requires the `data_cleanup` permission (owner-only by default).
 *   - Requires a typed confirmation phrase that exactly matches the target.
 *     This makes accidental requests from a misclick impossible — the body
 *     literally has to contain the words the UI shows the operator.
 *   - Catalog cleanup is explicit and cascades products, brands, grades,
 *     attributes, and categories so admins can rebuild the catalog manually.
 *   - Customer cleanup cascades to their orders + loyalty accounts to keep
 *     referential integrity, otherwise we'd leak `customerId` foreign keys.
 *
 * Returns `{ deletedCount }` so the UI can render a confirmation toast.
 */
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { badRequest, forbidden, ok, parseBody } from "@store/shared";
import { connectDB, Customer, Attribute, Brand, Category, handleMongoError, Inquiry, LoyaltyAccount, Order, Product, releaseStock } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { requireSession } from "@/lib/api/requireSession";
import { recordActivity } from "@/lib/services/activityLog";

const CLEANUP_TARGETS = ["catalog", "orders", "inquiries", "customers"] as const;
type CleanupTarget = (typeof CLEANUP_TARGETS)[number];

/**
 * The exact phrase the operator must type for each target. Mirroring the
 * resource name in caps reads naturally in a confirm dialog and prevents
 * "type 'yes' to confirm" muscle memory from causing real damage.
 */
const CONFIRMATION_PHRASES: Record<CleanupTarget, string> = {
	catalog: "DELETE ALL CATALOG",
	orders: "DELETE ALL ORDERS",
	inquiries: "DELETE ALL INQUIRIES",
	customers: "DELETE ALL CUSTOMERS",
};

interface CleanupBody {
	target?: unknown;
	confirmation?: unknown;
}

function isCleanupTarget(value: unknown): value is CleanupTarget {
	return typeof value === "string" && (CLEANUP_TARGETS as readonly string[]).includes(value);
}

export async function POST(request: Request): Promise<NextResponse> {
	const { actor, response } = await requireSession("data_cleanup");
	if (response) {
		return response;
	}

	const body = await parseBody<CleanupBody>(request);
	if (body instanceof Response) {
		return body as NextResponse;
	}

	if (!isCleanupTarget(body.target)) {
		return badRequest(`Target must be one of: ${CLEANUP_TARGETS.join(", ")}.`);
	}
	const target = body.target;
	const expected = CONFIRMATION_PHRASES[target];
	if (typeof body.confirmation !== "string" || body.confirmation.trim() !== expected) {
		// Use `forbidden` rather than `badRequest` to make it crystal clear in
		// logs that a confirmation challenge was failed.
		return forbidden(`Confirmation phrase must be exactly "${expected}".`);
	}

	await connectDB();
	try {
		const deletedCount = await runCleanup(target);

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: targetActivityResource(target),
			resourceLabel: `Bulk cleanup · ${target}`,
			detail: `Deleted ${deletedCount} record${deletedCount === 1 ? "" : "s"}`,
		});
		bustAdminCaches();

		return ok({ target, deletedCount });
	} catch (error) {
		return handleMongoError(error) as NextResponse;
	}
}

async function runCleanup(target: CleanupTarget): Promise<number> {
	switch (target) {
		case "catalog": {
			const [products, brands, grades, attributes, categories] = await Promise.all([
				Product.deleteMany({}),
				Brand.deleteMany({}),
				mongoose.connection.collection("grades").deleteMany({}),
				Attribute.deleteMany({}),
				Category.deleteMany({}),
			]);
			return (products.deletedCount ?? 0) + (brands.deletedCount ?? 0) + (grades.deletedCount ?? 0) + (attributes.deletedCount ?? 0) + (categories.deletedCount ?? 0);
		}
		case "orders": {
			await releaseReservedInventoryForAllOrders();
			const result = await Order.deleteMany({});
			return result.deletedCount ?? 0;
		}
		case "inquiries": {
			const result = await Inquiry.deleteMany({});
			return result.deletedCount ?? 0;
		}
		case "customers": {
			// Cascade — orphan orders + loyalty would leave dangling `customerId`
			// foreign keys and broken lifetime stats. Delete dependents first so
			// an interrupted cleanup never leaves an inconsistent customer doc.
			await releaseReservedInventoryForAllOrders();
			await Order.deleteMany({});
			await LoyaltyAccount.deleteMany({});
			const result = await Customer.deleteMany({});
			return result.deletedCount ?? 0;
		}
	}
}

async function releaseReservedInventoryForAllOrders(): Promise<void> {
	const reservedOrders = await Order.find({ inventoryReserved: true }).select("items").lean();
	for (const order of reservedOrders) {
		const lines = (order.items ?? []).map((line) => ({
			productId: line.productId,
			variantId: line.variantId,
			quantity: line.quantity,
		}));
		if (lines.length > 0) {
			await releaseStock(lines);
		}
	}
}

/** Map a cleanup target to the closest `ActivityResourceType` value. */
function targetActivityResource(target: CleanupTarget): "order" | "inquiry" | "customer" | "product" {
	switch (target) {
		case "catalog":
			return "product";
		case "orders":
			return "order";
		case "inquiries":
			return "inquiry";
		case "customers":
			return "customer";
	}
}
