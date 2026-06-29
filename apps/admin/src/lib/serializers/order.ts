import type { Types } from "mongoose";
import type { OrderAttributes, WithTimestamps } from "@store/db";
import { asArray, asNumber, asString, objectIdString, toIsoDate } from "@store/shared";
import type { AdminOrder, AdminOrderSummary } from "@/types/models";

export type OrderLean = WithTimestamps<OrderAttributes> & { _id: Types.ObjectId };

const EMPTY_TOTALS = {
	subtotalRupees: 0,
	shippingRupees: 0,
	discountRupees: 0,
	paymentSurchargeRupees: 0,
	totalRupees: 0,
};

export function summariseOrder(order: OrderLean): AdminOrderSummary {
	const items = asArray<OrderLean["items"][number]>(order?.items);
	const totals = order?.totals ?? EMPTY_TOTALS;
	const customer = order?.customerSnapshot ?? {
		name: "Customer",
		phoneNumber: "",
		city: "",
	};
	return {
		id: objectIdString(order?._id),
		orderNumber: asString(order?.orderNumber),
		customer: {
			id: objectIdString(order?.customerId),
			name: asString(customer?.name, "Customer"),
			phoneNumber: asString(customer?.phoneNumber),
			city: asString(customer?.city),
		},
		status: order?.status,
		totalRupees: asNumber(totals?.totalRupees),
		itemCount: items.reduce((sum, line) => sum + asNumber(line?.quantity), 0),
		payment: order?.payment,
		delivery: order?.delivery,
		placedAt: toIsoDate(order?.placedAt),
	};
}

export function toOrderResponse(order: OrderLean): AdminOrder {
	const items = asArray<OrderLean["items"][number]>(order?.items);
	const totals = order?.totals ?? EMPTY_TOTALS;
	return {
		...summariseOrder(order),
		items: items.map((line) => ({
			id: objectIdString(line?._id),
			productId: objectIdString(line?.productId),
			variantId: objectIdString(line?.variantId),
			productName: asString(line?.productName),
			variantSummary: asString(line?.variantSummary),
			unitPriceRupees: asNumber(line?.unitPriceRupees),
			quantity: asNumber(line?.quantity),
		})),
		totals: {
			subtotalRupees: asNumber(totals?.subtotalRupees),
			shippingRupees: asNumber(totals?.shippingRupees),
			discountRupees: asNumber(totals?.discountRupees),
			paymentSurchargeRupees: asNumber(totals?.paymentSurchargeRupees),
			totalRupees: asNumber(totals?.totalRupees),
		},
		address: order?.address
			? {
					recipientName: asString(order.address?.recipientName),
					phoneNumber: asString(order.address?.phoneNumber),
					city: asString(order.address?.city),
					area: order.address?.area,
					street: order.address?.street,
					postalCode: order.address?.postalCode,
				}
			: undefined,
		timeline: asArray<NonNullable<OrderLean["timeline"]>[number]>(order?.timeline).map((entry) => ({
			id: objectIdString(entry?._id),
			status: entry?.status,
			occurredAt: toIsoDate(entry?.occurredAt),
			note: entry?.note,
		})),
		trackingNote: order?.trackingNote,
		estimatedDeliveryAt: order?.estimatedDeliveryAt ? toIsoDate(order.estimatedDeliveryAt) : undefined,
		pointsEarned: order?.pointsEarned ?? 0,
		pointsRedeemed: order?.pointsRedeemed ?? 0,
		createdAt: toIsoDate(order?.createdAt),
		updatedAt: toIsoDate(order?.updatedAt),
	};
}
