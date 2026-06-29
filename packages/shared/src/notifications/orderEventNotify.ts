import { formatPrice } from "../formatters";
import { getPaymentMethodLabel } from "../constants";
import { orderPaymentToCheckoutId } from "../checkout/paymentInstructions";
import type { OrderPaymentMethod } from "../checkout/paymentInstructions";

import { dispatchStaffEmailAlerts, dispatchStaffWhatsAppAlerts } from "./staffAlertDispatch";
import { trySendWhatsAppCloudUtilityText } from "./whatsappCloudApi";

export type OrderNotifyEvent = "placed" | "status_changed" | "payment_confirmed" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
	"pending-payment": "Pending payment",
	confirmed: "Confirmed",
	packed: "Packed",
	dispatched: "Dispatched",
	delivered: "Delivered",
	cancelled: "Cancelled",
	refunded: "Refunded",
	returned: "Returned",
};

const CUSTOMER_NOTIFY_STATUSES = new Set(["confirmed", "packed", "dispatched", "delivered", "cancelled", "refunded"]);

export interface OrderEventNotifyInput {
	event: OrderNotifyEvent;
	orderId: string;
	orderNumber: string;
	customerName: string;
	customerPhone?: string;
	payment: OrderPaymentMethod;
	totalRupees: number;
	previousStatus?: string;
	nextStatus: string;
	siteName: string;
	adminSiteUrl?: string;
	staffEmails: string[];
	staffWhatsAppPhones: string[];
	whatsappStaffNotifyTemplate?: string;
	whatsappCustomerOrderTemplate?: string;
}

function statusLabel(status: string): string {
	return STATUS_LABELS[status] ?? status;
}

function eventHeadline(input: OrderEventNotifyInput): string {
	switch (input.event) {
		case "placed":
			return `New order ${input.orderNumber}`;
		case "payment_confirmed":
			return `Payment received · ${input.orderNumber}`;
		case "cancelled":
			return `Order cancelled · ${input.orderNumber}`;
		case "status_changed":
			return `Order ${input.orderNumber} → ${statusLabel(input.nextStatus)}`;
		default:
			return `Order ${input.orderNumber}`;
	}
}

function buildStaffBody(input: OrderEventNotifyInput): string {
	const adminBase = input.adminSiteUrl?.trim() || process.env.ADMIN_SITE_URL?.trim() || "";
	const orderPath = adminBase ? `${adminBase.replace(/\/$/, "")}/orders?order=${encodeURIComponent(input.orderNumber)}` : "/orders";
	const paymentLabel = getPaymentMethodLabel(orderPaymentToCheckoutId(input.payment) ?? input.payment);

	return [
		`${eventHeadline(input)} on ${input.siteName}`,
		"",
		`Order: ${input.orderNumber}`,
		input.previousStatus && input.event === "status_changed" ? `Was: ${statusLabel(input.previousStatus)}` : "",
		`Status: ${statusLabel(input.nextStatus)}`,
		`Payment: ${paymentLabel}`,
		`Total: ${formatPrice(input.totalRupees)}`,
		"",
		`Customer: ${input.customerName || "Customer"}`,
		input.customerPhone ? `Phone: ${input.customerPhone}` : "",
		"",
		`Open in admin: ${orderPath}`,
	]
		.filter(Boolean)
		.join("\n");
}

function buildCustomerBody(input: OrderEventNotifyInput): string {
	const lines = [
		`${input.siteName} — order ${input.orderNumber}`,
		`Status: ${statusLabel(input.nextStatus)}`,
		`Total: ${formatPrice(input.totalRupees)}`,
	];
	if (input.event === "payment_confirmed") {
		lines.push("Your online payment was received. Thank you!");
	}
	if (input.nextStatus === "dispatched") {
		lines.push("Your order is on the way.");
	}
	if (input.nextStatus === "delivered") {
		lines.push("Your order has been delivered. Thank you for shopping with us!");
	}
	if (input.nextStatus === "cancelled") {
		lines.push("This order was cancelled. Message us on WhatsApp if you need help.");
	}
	return lines.join("\n");
}

/** Staff email + WhatsApp for order lifecycle events. */
export async function notifyStaffOnOrderEvent(input: OrderEventNotifyInput): Promise<void> {
	const subject = `${eventHeadline(input)} · ${input.siteName}`;
	const body = buildStaffBody(input);

	await Promise.all([
		dispatchStaffEmailAlerts({
			recipients: input.staffEmails,
			subject,
			body,
			context: { orderId: input.orderId, event: input.event },
		}),
		dispatchStaffWhatsAppAlerts({
			phones: input.staffWhatsAppPhones,
			templateName: input.whatsappStaffNotifyTemplate,
			bodyText: body.slice(0, 900),
			context: { orderId: input.orderId, event: input.event },
		}),
	]);
}

/** Customer WhatsApp utility message on meaningful status changes. */
export async function notifyCustomerOnOrderUpdate(input: OrderEventNotifyInput): Promise<void> {
	const phone = input.customerPhone?.trim();
	const templateName = input.whatsappCustomerOrderTemplate?.trim();
	if (!phone || !templateName) {
		return;
	}

	if (input.event === "placed") {
		const bodyText = [
			`${input.siteName} — we received your order ${input.orderNumber}.`,
			`Status: ${statusLabel(input.nextStatus)}`,
			`Total: ${formatPrice(input.totalRupees)}`,
			"We will send updates here as your order moves forward.",
		].join("\n");
		await trySendWhatsAppCloudUtilityText({ toPhone: phone, templateName, bodyText: bodyText.slice(0, 900) });
		return;
	}

	if (input.event === "status_changed" && !CUSTOMER_NOTIFY_STATUSES.has(input.nextStatus)) {
		return;
	}

	const bodyText = buildCustomerBody(input).slice(0, 900);
	await trySendWhatsAppCloudUtilityText({
		toPhone: phone,
		templateName,
		bodyText,
	});
}

/** Staff + customer notifications for a single order event. */
export async function dispatchOrderEventNotifications(input: OrderEventNotifyInput): Promise<void> {
	await Promise.all([notifyStaffOnOrderEvent(input), notifyCustomerOnOrderUpdate(input)]);
}
