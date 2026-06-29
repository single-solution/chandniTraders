import type { Types } from "mongoose";

import type { IntegrationSettingsValues } from "@store/shared";

import { User } from "./models/User";
import { collectStaffEmailRecipients, collectStaffWhatsAppForInquiry } from "./staffNotifyContacts";

interface StoreSettingsEmailSource {
	supportEmail: string;
}

interface InquiryAssigneeSource {
	assignedToUserId?: Types.ObjectId | null;
}

export interface InquiryStaffNotifyTargets {
	notifyEmails: string[];
	notifyWhatsAppPhones: string[];
}

/**
 * Staff alert routing for inquiries: all team emails, assignee email when set,
 * global staff WhatsApp + assignee phone when set.
 */
export async function resolveInquiryStaffNotifyTargets(
	inquiry: InquiryAssigneeSource,
	integration: IntegrationSettingsValues,
	storeSettings: StoreSettingsEmailSource,
): Promise<InquiryStaffNotifyTargets> {
	let assigneeEmail = "";
	let assigneePhone = "";

	if (inquiry.assignedToUserId) {
		const assignee = await User.findById(inquiry.assignedToUserId)
			.select({ email: 1, phoneNumber: 1, isActive: 1 })
			.lean<{ email?: string; phoneNumber?: string; isActive?: boolean }>();
		if (assignee?.isActive) {
			assigneeEmail = assignee.email?.trim() ?? "";
			assigneePhone = assignee.phoneNumber?.trim() ?? "";
		}
	}

	const emails = new Set(await collectStaffEmailRecipients(integration, storeSettings, assigneeEmail));

	const notifyWhatsAppPhones = collectStaffWhatsAppForInquiry(integration, assigneePhone);

	return {
		notifyEmails: [...emails],
		notifyWhatsAppPhones,
	};
}
