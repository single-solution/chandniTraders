import mongoose from "mongoose";

import { requireSession } from "@/lib/api/requireSession";
import { readListOptions } from "@/lib/api/listOptions";
import { FIELD_LIMITS, badRequest, conflict, isValidationError, normalizePhoneNumber, ok, parseBody, validateString } from "@store/shared";

import { connectDB, Customer, handleMongoError, LoyaltyAccount } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { loadCustomerListPage, type CustomerSegment } from "@/lib/server/customerListQuery";
import { recordActivity } from "@/lib/services/activityLog";
import { toCustomerResponse, type CustomerLean } from "@/lib/serializers/customer";

/** Placeholder city for manually-created customers — mirrors the storefront
 *  OTP upsert, which seeds the same value until the customer fills it in. */
const PLACEHOLDER_CITY = "—";

/** Upper bound for a starter loyalty grant on a manually-created account. */
const LOYALTY_POINTS_MAX = 1_000_000;

export async function GET(request: Request) {
	const { response } = await requireSession("customer_view");
	if (response) {
		return response;
	}

	const { page, limit, search } = readListOptions(request);
	const segmentParam = new URL(request.url).searchParams.get("segment");
	const segment: CustomerSegment = segmentParam === "loyalty" || segmentParam === "active" ? segmentParam : "all";

	const payload = await loadCustomerListPage({ search, segment, page, limit });
	return ok(payload);
}

interface CustomerCreateInput {
	name?: unknown;
	phoneNumber?: unknown;
	city?: unknown;
	loyaltyPoints?: unknown;
}

/**
 * Manually create a customer record. Used when an operator needs to set up an
 * account for someone who can't self-register on the storefront (e.g. OTP
 * delivery is failing). The phone number becomes the customer's sign-in ID.
 */
export async function POST(request: Request) {
	const { actor, response } = await requireSession("customer_update");
	if (response) {
		return response;
	}

	const body = await parseBody<CustomerCreateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const nameResult = validateString(body.name, {
		label: "Name",
		max: FIELD_LIMITS.personName,
	});
	if (isValidationError(nameResult)) {
		return badRequest(nameResult.error);
	}

	const phoneRaw = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
	if (!phoneRaw) {
		return badRequest("Phone number is required — it is the customer's sign-in ID.");
	}
	if (phoneRaw.length > FIELD_LIMITS.phoneNumber) {
		return badRequest("Phone number is too long.");
	}
	// Persist the canonical +92… form so any input shape (0321…, +92 321…,
	// 0321-4232028, etc.) resolves to the same sign-in identity.
	const phoneNumber = normalizePhoneNumber(phoneRaw);
	if (!phoneNumber) {
		return badRequest("Enter a valid phone number the customer will use to sign in.");
	}

	let loyaltyPoints = 0;
	if (body.loyaltyPoints !== undefined && body.loyaltyPoints !== null && body.loyaltyPoints !== "") {
		const parsed = Number(body.loyaltyPoints);
		if (!Number.isInteger(parsed) || parsed < 0) {
			return badRequest("Loyalty points must be a whole number of zero or more.");
		}
		if (parsed > LOYALTY_POINTS_MAX) {
			return badRequest(`Loyalty points cannot exceed ${LOYALTY_POINTS_MAX.toLocaleString()}.`);
		}
		loyaltyPoints = parsed;
	}

	const create: Record<string, unknown> = {
		name: nameResult,
		phoneNumber,
		city: PLACEHOLDER_CITY,
		isLoyaltyMember: loyaltyPoints > 0,
		addresses: [],
	};

	if (typeof body.city === "string" && body.city.trim().length > 0) {
		const cityResult = validateString(body.city, { label: "City", max: FIELD_LIMITS.city });
		if (isValidationError(cityResult)) {
			return badRequest(cityResult.error);
		}
		create.city = cityResult;
	}

	await connectDB();

	const existing = await Customer.findOne({ phoneNumber }).lean<{ _id: unknown }>();
	if (existing) {
		return conflict("A customer with this phone number already exists.");
	}

	try {
		const doc = await Customer.create(create);

		await recordActivity({
			actor,
			action: "created",
			resourceType: "customer",
			resourceId: doc._id.toString(),
			resourceLabel: doc.name,
			detail: "Created manually in admin",
		});

		if (loyaltyPoints > 0) {
			const account = await LoyaltyAccount.findOneAndUpdate(
				{ customerId: doc._id },
				{
					$setOnInsert: {
						customerId: doc._id,
						balance: 0,
						lifetimeEarned: 0,
						pendingFromShipping: 0,
					},
				},
				{ new: true, upsert: true },
			);
			account.balance += loyaltyPoints;
			account.lifetimeEarned += loyaltyPoints;
			account.transactions.push({
				kind: "bonus",
				amount: loyaltyPoints,
				occurredAt: new Date(),
				reason: "Starter points on manual account creation",
				recordedByUserId: new mongoose.Types.ObjectId(actor.id),
			});
			await account.save();

			await recordActivity({
				actor,
				action: "updated",
				resourceType: "loyalty",
				resourceId: account._id.toString(),
				resourceLabel: doc.name,
				detail: `bonus ${loyaltyPoints} pts: starter grant`,
			});
		}

		bustAdminCaches();
		return ok(
			toCustomerResponse(doc.toObject() as unknown as CustomerLean, {
				orderCount: 0,
				lifetimeSpendRupees: 0,
				lastOrderAt: undefined,
			}),
		);
	} catch (error) {
		return handleMongoError(error);
	}
}
