import { logger } from "../logger";

import { sendResendEmail } from "./resendEmail";
import { trySendWhatsAppCloudUtilityText } from "./whatsappCloudApi";

/** Plain-text staff alert to one or more inboxes (deduped upstream). */
export async function dispatchStaffEmailAlerts(input: {
	recipients: string[];
	subject: string;
	body: string;
	context?: Record<string, string>;
}): Promise<void> {
	const unique = [...new Set(input.recipients.map((email) => email.trim()).filter(Boolean))];
	if (!unique.length) {
		return;
	}

	await Promise.all(
		unique.map(async (to) => {
			const sent = await sendResendEmail({ to, subject: input.subject, text: input.body });
			if (!sent) {
				logger.warn({ to, ...input.context }, "Staff email alert skipped or failed");
			}
		}),
	);
}

/** Utility-template WhatsApp to each distinct phone (deduped upstream). */
export async function dispatchStaffWhatsAppAlerts(input: {
	phones: string[];
	templateName?: string;
	bodyText: string;
	context?: Record<string, string>;
}): Promise<void> {
	const templateName = input.templateName?.trim();
	if (!templateName) {
		return;
	}

	const unique = [...new Set(input.phones.map((phone) => phone.trim()).filter(Boolean))];
	if (!unique.length) {
		return;
	}

	await Promise.all(
		unique.map((toPhone) =>
			trySendWhatsAppCloudUtilityText({
				toPhone,
				templateName,
				bodyText: input.bodyText,
			}),
		),
	);
}
