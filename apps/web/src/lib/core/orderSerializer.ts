/**
 * DB → public storefront order shape.
 *
 * The customer never needs admin-only fields like `customerId`, internal
 * gateway references, agent notes, etc. This serializer also maps the raw
 * DB statuses ("pending-payment", "dispatched", …) to friendlier labels
 * the UI uses.
 */

import type { OrderAttributes, OrderStatus, OrderTimelineEntryAttributes } from "@store/db";
import { asArray, asNumber, asString, objectIdString, toIsoDate, toMillis } from "@store/shared";

interface OrderItem {
	id: string;
	productName: string;
	variantSummary: string;
	unitPriceRupees: number;
	quantity: number;
}

interface OrderTotals {
	subtotalRupees: number;
	shippingRupees: number;
	discountRupees: number;
	paymentSurchargeRupees: number;
	totalRupees: number;
	itemCount: number;
}

export interface OrderTimelineEntry {
	status: OrderStatus;
	label: string;
	description: string;
	occurredAt: string;
}

export interface Order {
	id: string;
	orderNumber: string;
	placedAt: string;
	status: OrderStatus;
	/** Customer-facing label — "On the way", "Awaiting payment", etc. */
	statusLabel: string;
	items: OrderItem[];
	delivery: OrderAttributes["delivery"];
	payment: OrderAttributes["payment"];
	customerName: string;
	customerPhone: string;
	city: string;
	address?: {
		recipientName: string;
		phoneNumber: string;
		city: string;
		area?: string;
		street?: string;
		postalCode?: string;
	};
	totals: OrderTotals;
	timeline: OrderTimelineEntry[];
	trackingNote?: string;
	dispatchVideoUrl?: string;
	estimatedDeliveryAt?: string;
	pointsEarned: number;
	pointsRedeemed: number;
}

/** Pretty status label shown to customers. */
function resolveOrderStatusLabel(status: OrderStatus, payment: OrderAttributes["payment"]): string {
	if (status === "pending-payment" && payment === "bank-transfer") {
		return "Awaiting bank transfer";
	}
	if (status === "pending-payment" && payment === "card") {
		return "Awaiting card payment";
	}
	return ORDER_STATUS_LABEL[status] ?? status;
}

/** Short description shown next to a timeline entry. */
function resolveTimelineDescription(status: OrderStatus, payment: OrderAttributes["payment"], note?: string): string {
	const trimmedNote = note?.trim();
	if (trimmedNote) {
		return trimmedNote;
	}
	if (status === "pending-payment" && payment === "bank-transfer") {
		return "Transfer the amount and send your payment screenshot on WhatsApp.";
	}
	if (status === "pending-payment" && payment === "card") {
		return "Complete card payment online to confirm your order.";
	}
	if (status === "pending-payment" && payment === "cod") {
		return "We received your order — pay cash when it arrives.";
	}
	if (status === "confirmed" && payment === "cod") {
		return "We're preparing your order. Pay cash when you receive it.";
	}
	if (status === "confirmed" && payment === "bank-transfer") {
		return "Bank transfer received — we're packing your order.";
	}
	if (status === "confirmed" && payment === "card") {
		return "Card payment received — we're packing your order.";
	}
	return TIMELINE_DESCRIPTION[status] || "";
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
	"pending-payment": "Awaiting payment",
	confirmed: "Confirmed",
	packed: "Packed & Video Added",
	dispatched: "On the way",
	delivered: "Delivered",
	cancelled: "Cancelled",
	refunded: "Refunded",
	returned: "Returned",
};

/** Short description shown next to a timeline entry. */
const TIMELINE_DESCRIPTION: Record<OrderStatus, string> = {
	"pending-payment": "We received your order and are waiting for payment.",
	confirmed: "Payment confirmed — we're packing your order.",
	packed: "Order is packed and dispatch video has been added.",
	dispatched: "Your package is with the courier.",
	delivered: "Your order arrived. Enjoy!",
	cancelled: "This order was cancelled.",
	refunded: "We refunded the order amount.",
	returned: "Order was returned.",
};

/**
 * Convert a Mongoose lean Order to the public storefront shape.
 */
export function toOrder(order: OrderAttributes & { _id: { toString(): string } }): Order {
	const items = asArray<OrderAttributes["items"][number]>(order.items);
	const totals = order.totals ?? {
		subtotalRupees: 0,
		shippingRupees: 0,
		discountRupees: 0,
		paymentSurchargeRupees: 0,
		totalRupees: 0,
	};
	const customer = order.customerSnapshot ?? {
		name: "Customer",
		phoneNumber: "",
		city: "",
	};
	const itemCount = items.reduce((sum, line) => sum + asNumber(line?.quantity), 0);

	const timeline: OrderTimelineEntry[] = asArray<OrderTimelineEntryAttributes>(order.timeline)
		.slice()
		.sort((left: OrderTimelineEntryAttributes, right: OrderTimelineEntryAttributes) => toMillis(left?.occurredAt) - toMillis(right?.occurredAt))
		.map((entry) => ({
			status: entry.status,
			label: resolveOrderStatusLabel(entry.status, order.payment),
			description: resolveTimelineDescription(entry.status, order.payment, entry.note),
			occurredAt: toIsoDate(entry.occurredAt),
		}));

	return {
		id: objectIdString(order._id),
		orderNumber: asString(order.orderNumber),
		placedAt: toIsoDate(order.placedAt),
		status: order.status,
		statusLabel: resolveOrderStatusLabel(order.status, order.payment),
		items: items.map((line) => ({
			id: objectIdString(line?._id) || `${objectIdString(line?.productId)}:${objectIdString(line?.variantId)}`,
			productName: asString(line?.productName),
			variantSummary: asString(line?.variantSummary),
			unitPriceRupees: asNumber(line?.unitPriceRupees),
			quantity: asNumber(line?.quantity),
		})),
		delivery: order.delivery,
		payment: order.payment,
		customerName: asString(customer.name, "Customer"),
		customerPhone: asString(customer.phoneNumber),
		city: asString(customer.city),
		address: order.address
			? {
					recipientName: asString(order.address.recipientName),
					phoneNumber: asString(order.address.phoneNumber),
					city: asString(order.address.city),
					area: order.address.area,
					street: order.address.street,
					postalCode: order.address.postalCode,
				}
			: undefined,
		totals: {
			subtotalRupees: asNumber(totals.subtotalRupees),
			shippingRupees: asNumber(totals.shippingRupees),
			discountRupees: asNumber(totals.discountRupees),
			paymentSurchargeRupees: asNumber(totals.paymentSurchargeRupees),
			totalRupees: asNumber(totals.totalRupees),
			itemCount,
		},
		timeline,
		trackingNote: order.trackingNote,
		dispatchVideoUrl: order.dispatchVideoUrl,
		estimatedDeliveryAt: order.estimatedDeliveryAt ? toIsoDate(order.estimatedDeliveryAt) : undefined,
		pointsEarned: order.pointsEarned ?? 0,
		pointsRedeemed: order.pointsRedeemed ?? 0,
	};
}
