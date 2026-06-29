/**
 * Order status transitions — stock release and loyalty side effects.
 * Shared by admin and storefront cancel flows.
 */

import mongoose from "mongoose";

import { logger } from "@store/shared";

import { LoyaltyAccount, Order, type OrderDoc, type OrderStatus } from "./models";
import { releaseStock } from "./inventory";

const STOCK_RELEASE_STATUSES: OrderStatus[] = ["cancelled", "refunded", "returned"];

const LOYALTY_CREDITED_STATUSES: OrderStatus[] = ["delivered"];
const LOYALTY_REVERSED_STATUSES: OrderStatus[] = ["cancelled", "refunded"];
const REDEEM_REFUND_STATUSES: OrderStatus[] = ["cancelled", "refunded", "returned"];

export interface OrderTransitionActor {
	id: string;
}

interface TransitionOptions {
	order: OrderDoc;
	previousStatus: OrderStatus;
	nextStatus: OrderStatus;
	actor: OrderTransitionActor;
}

export async function applyOrderTransition(options: TransitionOptions): Promise<void> {
	const { order, previousStatus, nextStatus, actor } = options;
	if (previousStatus === nextStatus) {
		return;
	}

	await releaseStockForTransition(order, nextStatus);
	await updateLoyaltyForTransition(order, previousStatus, nextStatus, actor);
	await refundRedeemedPointsForTransition(order, nextStatus, actor);
}

async function releaseStockForTransition(order: OrderDoc, nextStatus: OrderStatus) {
	if (!STOCK_RELEASE_STATUSES.includes(nextStatus)) {
		return;
	}

	const claimed = await Order.findOneAndUpdate({ _id: order._id, inventoryReserved: true }, { $set: { inventoryReserved: false } }).lean();
	if (!claimed) {
		return;
	}
	order.inventoryReserved = false;

	await releaseStock(
		order.items.map((line) => ({
			productId: line.productId,
			variantId: line.variantId,
			quantity: line.quantity,
		})),
	);
}

async function updateLoyaltyForTransition(order: OrderDoc, previousStatus: OrderStatus, nextStatus: OrderStatus, actor: OrderTransitionActor) {
	const wasCredited = LOYALTY_CREDITED_STATUSES.includes(previousStatus);
	const willCredit = LOYALTY_CREDITED_STATUSES.includes(nextStatus);
	const willReverse = LOYALTY_REVERSED_STATUSES.includes(nextStatus) && wasCredited;

	if (!willCredit && !willReverse) {
		return;
	}
	if (order.pointsEarned <= 0) {
		return;
	}

	try {
		const account = willCredit
			? await LoyaltyAccount.findOneAndUpdate(
					{ customerId: order.customerId },
					{
						$setOnInsert: {
							customerId: order.customerId,
							balance: 0,
							lifetimeEarned: 0,
							pendingFromShipping: 0,
						},
					},
					{ new: true, upsert: true },
				)
			: await LoyaltyAccount.findOne({ customerId: order.customerId });
		if (!account) {
			logger.info({ customerId: order.customerId.toString(), orderNumber: order.orderNumber }, "Skipping loyalty reversal — no account on file");
			return;
		}

		const recordedByUserId = new mongoose.Types.ObjectId(actor.id);

		if (willCredit) {
			account.balance += order.pointsEarned;
			account.lifetimeEarned += order.pointsEarned;
			account.transactions.push({
				kind: "earn",
				amount: order.pointsEarned,
				reason: `Earned on order ${order.orderNumber}`,
				orderRef: order.orderNumber,
				recordedByUserId,
				occurredAt: new Date(),
			});
		} else if (willReverse) {
			const reversal = Math.min(account.balance, order.pointsEarned);
			account.balance -= reversal;
			account.transactions.push({
				kind: "adjust",
				amount: -reversal,
				reason: `Reversed for ${nextStatus} order ${order.orderNumber}`,
				orderRef: order.orderNumber,
				recordedByUserId,
				occurredAt: new Date(),
			});
		}

		await account.save();
	} catch (error) {
		logger.error({ error, orderNumber: order.orderNumber }, "Failed to update loyalty account during order transition");
	}
}

async function refundRedeemedPointsForTransition(order: OrderDoc, nextStatus: OrderStatus, actor: OrderTransitionActor) {
	if (!REDEEM_REFUND_STATUSES.includes(nextStatus)) {
		return;
	}
	if (order.pointsRedeemed <= 0) {
		return;
	}

	const refundReason = `Redeemed points refunded for ${nextStatus} order ${order.orderNumber}`;

	try {
		const account = await LoyaltyAccount.findOne({ customerId: order.customerId });
		if (!account) {
			logger.info({ customerId: order.customerId.toString(), orderNumber: order.orderNumber }, "Skipping redeem refund — no loyalty account");
			return;
		}

		const alreadyRefunded = account.transactions.some((entry) => entry.reason === refundReason);
		if (alreadyRefunded) {
			return;
		}

		account.balance += order.pointsRedeemed;
		account.transactions.push({
			kind: "adjust",
			amount: order.pointsRedeemed,
			reason: refundReason,
			orderRef: order.orderNumber,
			recordedByUserId: new mongoose.Types.ObjectId(actor.id),
			occurredAt: new Date(),
		});
		await account.save();
	} catch (error) {
		logger.error({ error, orderNumber: order.orderNumber }, "Failed to refund redeemed loyalty points during order transition");
	}
}
