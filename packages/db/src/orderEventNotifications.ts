import { dispatchOrderEventNotifications, type OrderNotifyEvent } from "@store/shared/server";
import type { OrderPaymentMethod } from "@store/shared";

import { getIntegrationSettings } from "./integrationSettings";
import type { OrderDoc } from "./models/Order";
import { getStoreSettings } from "./storeSettings";
import { collectStaffEmailRecipients, collectStaffWhatsAppForShopEvent } from "./staffNotifyContacts";

interface FireOrderEventOptions {
	event: OrderNotifyEvent;
	order: Pick<OrderDoc, "_id" | "orderNumber" | "payment" | "totals" | "customerSnapshot" | "status">;
	previousStatus?: string;
	nextStatus?: string;
}

/** Load staff routing + fire staff/customer order notifications. */
export async function fireOrderEventNotifications(options: FireOrderEventOptions): Promise<void> {
	const { order, event, previousStatus } = options;
	const nextStatus = options.nextStatus ?? order.status ?? "pending-payment";

	const [integration, settings] = await Promise.all([getIntegrationSettings(), getStoreSettings()]);
	const [staffEmails, staffWhatsAppPhones] = await Promise.all([
		collectStaffEmailRecipients(integration, settings),
		collectStaffWhatsAppForShopEvent(integration),
	]);

	if (!staffEmails.length && !staffWhatsAppPhones.length && !order.customerSnapshot?.phoneNumber) {
		return;
	}

	await dispatchOrderEventNotifications({
		event,
		orderId: order._id.toString(),
		orderNumber: order.orderNumber,
		customerName: order.customerSnapshot?.name ?? "Customer",
		customerPhone: order.customerSnapshot?.phoneNumber,
		payment: order.payment as OrderPaymentMethod,
		totalRupees: order.totals?.totalRupees ?? 0,
		previousStatus,
		nextStatus,
		siteName: settings.siteName,
		adminSiteUrl: integration.adminSiteUrl.trim() || undefined,
		staffEmails,
		staffWhatsAppPhones,
		whatsappStaffNotifyTemplate: integration.whatsappStaffNotifyTemplate.trim() || undefined,
		whatsappCustomerOrderTemplate: integration.whatsappCustomerOrderTemplate.trim() || undefined,
	});
}
