import { logger } from "../logger";

import { dispatchStaffEmailAlerts, dispatchStaffWhatsAppAlerts } from "./staffAlertDispatch";

export interface InquiryStaffNotifyInput {
	inquiryId: string;
	customerName: string;
	phoneNumber?: string;
	messagePreview: string;
	notifyEmails: string[];
	notifyWhatsAppPhones: string[];
	whatsappStaffNotifyTemplate?: string;
	siteName: string;
	adminSiteUrl?: string;
}

/**
 * Fire-and-forget staff alert when a customer sends a chat message or a thread is escalated.
 */
export async function notifyStaffOnCustomerMessage(input: InquiryStaffNotifyInput): Promise<void> {
	await dispatchInquiryStaffAlert({
		...input,
		subject: `New chat — ${input.customerName || "Customer"} · ${input.siteName}`,
		headline: `New message on ${input.siteName}`,
	});
}

export async function notifyStaffOnInquiryEscalation(input: InquiryStaffNotifyInput): Promise<void> {
	await dispatchInquiryStaffAlert({
		...input,
		subject: `Chat needs you — ${input.customerName || "Customer"} · ${input.siteName}`,
		headline: `Customer requested a human on ${input.siteName}`,
	});
}

async function dispatchInquiryStaffAlert(
	input: InquiryStaffNotifyInput & { subject: string; headline: string },
): Promise<void> {
	const adminBase = input.adminSiteUrl?.trim() || process.env.ADMIN_SITE_URL?.trim() || "";
	const inquiryPath = adminBase ? `${adminBase.replace(/\/$/, "")}/inquiries?inquiry=${encodeURIComponent(input.inquiryId)}` : "/inquiries";
	const body = [
		input.headline,
		"",
		`Customer: ${input.customerName || "Guest"}`,
		input.phoneNumber ? `Phone: ${input.phoneNumber}` : "",
		"",
		input.messagePreview.slice(0, 500),
		"",
		`Open in admin: ${inquiryPath}`,
	]
		.filter(Boolean)
		.join("\n");

	await Promise.all([
		dispatchStaffEmailAlerts({
			recipients: input.notifyEmails,
			subject: input.subject,
			body,
			context: { inquiryId: input.inquiryId },
		}),
		dispatchStaffWhatsAppAlerts({
			phones: input.notifyWhatsAppPhones,
			templateName: input.whatsappStaffNotifyTemplate,
			bodyText: body.slice(0, 900),
			context: { inquiryId: input.inquiryId },
		}),
	]);
}

export interface CustomerChatNotifyInput {
	customerPhone?: string;
	customerName: string;
	agentName: string;
	messagePreview: string;
	siteName: string;
	whatsappCustomerOrderTemplate?: string;
}

/** WhatsApp utility message when an agent replies in chat. */
export async function notifyCustomerOnAgentReply(input: CustomerChatNotifyInput): Promise<void> {
	const phone = input.customerPhone?.trim();
	const templateName = input.whatsappCustomerOrderTemplate?.trim();
	if (!phone || !templateName) {
		return;
	}

	const { trySendWhatsAppCloudUtilityText } = await import("./whatsappCloudApi");
	const bodyText = [
		`${input.siteName} support`,
		`${input.agentName} replied:`,
		input.messagePreview.slice(0, 400),
	]
		.filter(Boolean)
		.join("\n");

	try {
		await trySendWhatsAppCloudUtilityText({
			toPhone: phone,
			templateName,
			bodyText: bodyText.slice(0, 900),
		});
	} catch (error) {
		logger.warn({ error }, "Customer chat reply WhatsApp failed");
	}
}
