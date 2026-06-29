import { requireSession } from "@/lib/api/requireSession";
import { connectDB, Customer, handleMongoError, Order } from "@store/db";
import { FIELD_LIMITS, badRequest, conflict, isValidId, isValidationError, noContent, notFound, ok, parseBody, validateEmail, validateString } from "@store/shared";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { loadCustomerOrderStats } from "@/lib/server/customerOrderStats";
import { toCustomerResponse, type CustomerLean } from "@/lib/serializers/customer";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("customer_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const doc = await Customer.findById(id).lean<CustomerLean>();
	if (!doc) {
		return notFound("Customer not found");
	}

	const stat = await loadCustomerOrderStats(doc._id);
	return ok(toCustomerResponse(doc, stat));
}

interface CustomerUpdateInput {
	name?: unknown;
	phoneNumber?: unknown;
	city?: unknown;
	isLoyaltyMember?: unknown;
	notes?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("customer_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<CustomerUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};

	if (body.name !== undefined) {
		const result = validateString(body.name, { label: "Name", max: FIELD_LIMITS.personName });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.name = result;
	}
	if (body.phoneNumber !== undefined) {
		return badRequest("Phone number is the customer's storefront sign-in ID and cannot be changed from admin.");
	}
	if (body.city !== undefined) {
		const result = validateString(body.city, { label: "City", max: FIELD_LIMITS.city });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.city = result;
	}
	if (body.isLoyaltyMember !== undefined) {
		update.isLoyaltyMember = Boolean(body.isLoyaltyMember);
	}
	if (typeof body.notes === "string") {
		update.notes = body.notes.trim().slice(0, FIELD_LIMITS.crmNotes);
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const doc = await Customer.findByIdAndUpdate(
			id,
			{ $set: update },
			{
				new: true,
				runValidators: true,
			},
		).lean<CustomerLean>();
		if (!doc) {
			return notFound("Customer not found");
		}

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "customer",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		const stat = await loadCustomerOrderStats(doc._id);
		return ok(toCustomerResponse(doc, stat));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("customer_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	// Referential integrity — orders reference customers and we keep the
	// customerSnapshot for display, but a hard delete still leaves dangling
	// `customerId` foreign keys. Block the delete and prompt the admin to
	// archive instead (we keep customers around for lifetime stats).
	const orderCount = await Order.countDocuments({ customerId: id });
	if (orderCount > 0) {
		return conflict(`Cannot delete a customer with ${orderCount} order${orderCount === 1 ? "" : "s"}.`);
	}

	try {
		const doc = await Customer.findByIdAndDelete(id).lean<CustomerLean>();
		if (!doc) {
			return notFound("Customer not found");
		}

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "customer",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
