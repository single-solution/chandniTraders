import type { Types } from "mongoose";

import { Order, type OrderDoc, type OrderStatus } from "./models";

interface TimelineEntry {
	status: OrderStatus;
	occurredAt: Date;
	note?: string;
}

export interface ClaimOrderStatusInput {
	orderId?: Types.ObjectId | string;
	orderNumber?: string;
	customerId?: Types.ObjectId | string;
	fromStatuses: OrderStatus[];
	toStatus: OrderStatus;
	timelineNote?: string;
	additionalFilter?: Record<string, unknown>;
	additionalSet?: Record<string, unknown>;
}

/**
 * Atomically move an order to `toStatus` only when its current status is in
 * `fromStatuses`. Returns the updated document or null when the claim lost a race.
 */
export async function claimOrderStatusTransition(input: ClaimOrderStatusInput): Promise<OrderDoc | null> {
	const filter: Record<string, unknown> = {
		status: { $in: input.fromStatuses },
		...input.additionalFilter,
	};

	if (input.orderId) {
		filter._id = input.orderId;
	}
	if (input.orderNumber) {
		filter.orderNumber = input.orderNumber;
	}
	if (input.customerId) {
		filter.customerId = input.customerId;
	}

	const timelineEntry: TimelineEntry = {
		status: input.toStatus,
		occurredAt: new Date(),
	};
	if (input.timelineNote?.trim()) {
		timelineEntry.note = input.timelineNote.trim();
	}

	return Order.findOneAndUpdate(
		filter,
		{
			$set: {
				status: input.toStatus,
				...input.additionalSet,
			},
			$push: { timeline: timelineEntry },
		},
		{ new: true },
	);
}
