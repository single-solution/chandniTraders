/**
 * Verified customer session — the storefront's mirror of admin's
 * `getVerifiedSession()`.
 *
 * The JWT proves identity; the DB lookup proves the Customer still exists.
 * Routes MUST call this as the first line instead of reading `session.user.*`
 * directly so a token whose Customer row was deleted/disabled cannot keep
 * issuing requests.
 *
 * In-process cache keeps the DB cost to one hit per `SESSION_CACHE_TTL_MS`
 * window so fan-out requests on a page load don't multiply lookups.
 */

import { Types } from "mongoose";

import { Customer, connectDB } from "@store/db";
import { SESSION_CACHE_TTL_MS, logger } from "@store/shared";

import { auth } from "@/lib/auth";

export interface VerifiedCustomer {
	id: string;
	name: string;
	phoneNumber: string;
	city: string;
	isLoyaltyMember: boolean;
}

interface CacheEntry {
	customer: VerifiedCustomer;
	cachedAt: number;
}

const customerCache = new Map<string, CacheEntry>();

/** Drop a single customer's cached session — call after profile mutations. */
export function invalidateCustomerSessionCache(customerId: string): void {
	customerCache.delete(customerId);
}

export async function getVerifiedCustomer(): Promise<VerifiedCustomer | null> {
	const session = await auth();
	const customerId = session?.user?.customerId;
	if (!session?.user || session.user.role !== "customer" || !customerId) {
		return null;
	}
	if (!Types.ObjectId.isValid(customerId)) {
		return null;
	}

	const cached = customerCache.get(customerId);
	if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
		return cached.customer;
	}

	await connectDB();
	const record = await Customer.findById(customerId).lean();
	if (!record) {
		customerCache.delete(customerId);
		logger.info({ customerId }, "Storefront session rejected: customer not found");
		return null;
	}

	const verified: VerifiedCustomer = {
		id: String(record._id),
		name: record.name,
		phoneNumber: record.phoneNumber,
		city: record.city,
		isLoyaltyMember: record.isLoyaltyMember === true,
	};
	customerCache.set(customerId, { customer: verified, cachedAt: Date.now() });
	return verified;
}
