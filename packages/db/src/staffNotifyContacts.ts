import type { IntegrationSettingsValues } from "@store/shared";

import { User } from "./models/User";

interface StoreSettingsEmailSource {
	supportEmail: string;
}

/** Every active team email plus staff/support inboxes — staff must not miss alerts. */
export async function collectStaffEmailRecipients(
	integration: IntegrationSettingsValues,
	storeSettings: StoreSettingsEmailSource,
	extraEmail?: string,
): Promise<string[]> {
	const emails = new Set<string>();
	const primary = integration.staffNotifyEmail.trim() || storeSettings.supportEmail.trim();
	const support = storeSettings.supportEmail.trim();
	if (primary) {
		emails.add(primary);
	}
	if (support) {
		emails.add(support);
	}
	if (extraEmail?.trim()) {
		emails.add(extraEmail.trim());
	}

	const team = await User.find({ isActive: { $ne: false } })
		.select({ email: 1 })
		.lean<Array<{ email?: string }>>();
	for (const member of team) {
		const email = member.email?.trim();
		if (email) {
			emails.add(email);
		}
	}

	return [...emails];
}

/** Shop-wide ops (new order, status change, cancel) — global staff line + every active user with a phone. */
export async function collectStaffWhatsAppForShopEvent(integration: IntegrationSettingsValues): Promise<string[]> {
	const phones = new Set<string>();
	const global = integration.staffNotifyWhatsApp.trim();
	if (global) {
		phones.add(global);
	}

	const team = await User.find({ isActive: { $ne: false } })
		.select({ phoneNumber: 1 })
		.lean<Array<{ phoneNumber?: string }>>();
	for (const member of team) {
		const phone = member.phoneNumber?.trim();
		if (phone) {
			phones.add(phone);
		}
	}

	return [...phones];
}

/** Inquiry-scoped — global staff line + assigned agent phone when set. */
export function collectStaffWhatsAppForInquiry(integration: IntegrationSettingsValues, assigneePhone?: string): string[] {
	const phones = new Set<string>();
	const global = integration.staffNotifyWhatsApp.trim();
	if (global) {
		phones.add(global);
	}
	if (assigneePhone?.trim()) {
		phones.add(assigneePhone.trim());
	}
	return [...phones];
}
