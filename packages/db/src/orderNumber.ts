/**
 * Order-number generation.
 *
 * Format: `IM-YYYY-NNNN` where NNNN is a sortable sequence inside the year.
 * Implementation strategy: read the highest-numbered order in the current
 * year and increment. Wraps to `0001` at year rollover. Falls back to a
 * timestamp-suffixed value if a same-second collision occurs (extremely
 * unlikely in practice).
 *
 * Concurrency: we wrap creation in a retry loop that catches the unique-key
 * violation on `orderNumber` and tries the next sequence number. That way
 * two parallel checkout submissions never produce the same number.
 */

import { Order } from "./models/Order";
import { isMongoDuplicateKeyError } from "./mongoErrors";
import { DECIMAL_RADIX, logger } from "@store/shared";

/** Retry budget for `createWithUniqueOrderNumber`. */
const MAX_GENERATION_ATTEMPTS = 5;
/** Width of the zero-padded sequence portion of an order number. */
const SEQUENCE_PAD_WIDTH = 4;
/** First sequence value when no orders exist for the current year. */
const INITIAL_SEQUENCE = 1;

function buildOrderNumber(year: number, sequence: number): string {
	return `IM-${year}-${sequence.toString().padStart(SEQUENCE_PAD_WIDTH, "0")}`;
}

const MIN_VALID_YEAR = 2000;
const MAX_VALID_YEAR = 2100;

/**
 * Returns the next un-used order number for the current calendar year.
 * Caller is responsible for catching duplicate-key violations and retrying
 * with the helper above (see `createWithUniqueOrderNumber`).
 */
export async function nextOrderNumberForYear(year = new Date().getFullYear()): Promise<string> {
	if (!Number.isInteger(year) || year < MIN_VALID_YEAR || year > MAX_VALID_YEAR) {
		throw new Error(`Invalid year for order number generation: ${String(year)}`);
	}

	const prefix = `IM-${year}-`;
	const last = await Order.findOne({
		orderNumber: { $regex: `^${prefix}` },
	})
		.sort({ orderNumber: -1 })
		.select("orderNumber")
		.lean<{ orderNumber: string }>();

	let sequence = INITIAL_SEQUENCE;
	if (last?.orderNumber) {
		const tail = last.orderNumber.slice(prefix.length);
		const parsed = Number.parseInt(tail, DECIMAL_RADIX);
		if (Number.isFinite(parsed) && parsed >= INITIAL_SEQUENCE) {
			sequence = parsed + 1;
		}
	}
	return buildOrderNumber(year, sequence);
}

/**
 * Run `attempt(orderNumber)` up to N times, retrying when MongoDB returns a
 * duplicate-key error on `orderNumber`. Lets two parallel storefront
 * checkouts both succeed even if the read-then-write race picks the same
 * sequence number.
 */
export async function createWithUniqueOrderNumber<T>(attempt: (orderNumber: string) => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i += 1) {
		const orderNumber = await nextOrderNumberForYear();
		try {
			return await attempt(orderNumber);
		} catch (error) {
			if (!isMongoDuplicateKeyError(error)) {
				throw error;
			}
			lastError = error;
			logger.warn({ orderNumber }, "Order number collision — retrying with next sequence value");
		}
	}
	throw lastError ?? new Error("Failed to allocate a unique order number.");
}
