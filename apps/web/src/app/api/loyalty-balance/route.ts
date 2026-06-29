/**
 * Signed-in loyalty balance for checkout.
 *
 * POST /api/loyalty-balance
 *
 * Returns the authenticated customer's points balance only — never accepts an
 * arbitrary phone number (prevents balance enumeration).
 */

import { Customer, LoyaltyAccount, connectDB } from "@store/db";
import { logger, ok, PER_MINUTE_WINDOW_MS, serverError, unauthorized } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { getVerifiedCustomer } from "@/lib/server/customerSession";

/** Per-customer lookups allowed per minute — cheap guard against abuse. */
const LOYALTY_LOOKUPS_PER_MINUTE = 30;

interface LookupResponse {
	isMember: boolean;
	balance: number;
	lifetimeEarned: number;
}

const NOT_A_MEMBER: LookupResponse = {
	isMember: false,
	balance: 0,
	lifetimeEarned: 0,
};

export async function POST(request: Request) {
	const actor = await getVerifiedCustomer();
	if (!actor) {
		return unauthorized();
	}

	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-loyalty-lookup",
		identifier: actor.id,
		max: LOYALTY_LOOKUPS_PER_MINUTE,
		windowMs: PER_MINUTE_WINDOW_MS,
	});
	if (limited) {
		return limited;
	}

	try {
		await connectDB();
		const customer = await Customer.findById(actor.id).select("_id isLoyaltyMember").lean<{ _id: import("mongoose").Types.ObjectId; isLoyaltyMember: boolean }>();
		if (!customer?.isLoyaltyMember) {
			return ok(NOT_A_MEMBER);
		}

		const account = await LoyaltyAccount.findOne({ customerId: customer._id }).select("balance lifetimeEarned").lean<{ balance: number; lifetimeEarned: number }>();
		if (!account) {
			return ok(NOT_A_MEMBER);
		}

		return ok<LookupResponse>({
			isMember: true,
			balance: account.balance,
			lifetimeEarned: account.lifetimeEarned,
		});
	} catch (error) {
		logger.error({ error, customerId: actor.id }, "loyalty-balance check failed");
		return serverError("Failed to look up balance.");
	}
}
