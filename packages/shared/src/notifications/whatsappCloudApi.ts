import { FIELD_LIMITS } from "../constants";
import { logger } from "../logger";
import { normalizePhoneNumber } from "../phone";

export interface WhatsAppCloudConfig {
	accessToken: string;
	phoneNumberId: string;
	apiVersion: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/** Meta WhatsApp Cloud API — Business account phone number ID + permanent token. */
export function readWhatsAppCloudConfigFromEnv(): WhatsAppCloudConfig | null {
	const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
	const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
	if (!accessToken || !phoneNumberId) {
		return null;
	}
	return {
		accessToken,
		phoneNumberId,
		apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION?.trim() || "v21.0",
	};
}

/** E.164 without `+` — required by Graph API `to` field. */
export function toWhatsAppCloudRecipient(phone: string): string | null {
	const normalized = normalizePhoneNumber(phone);
	if (!normalized) {
		return null;
	}
	return normalized.replace(/^\+/, "");
}

interface TemplateComponent {
	type: "body" | "button";
	sub_type?: "url";
	index?: string;
	parameters: Array<{ type: "text"; text: string }>;
}

export async function sendWhatsAppCloudTemplate(input: {
	config: WhatsAppCloudConfig;
	toPhone: string;
	templateName: string;
	languageCode?: string;
	components: TemplateComponent[];
}): Promise<void> {
	const recipient = toWhatsAppCloudRecipient(input.toPhone);
	if (!recipient) {
		throw new Error("Invalid WhatsApp recipient phone number.");
	}

	const url = `https://graph.facebook.com/${input.config.apiVersion}/${input.config.phoneNumberId}/messages`;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.config.accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: recipient,
			type: "template",
			template: {
				name: input.templateName,
				language: { code: input.languageCode ?? "en" },
				components: input.components,
			},
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(`WhatsApp Cloud API failed (HTTP ${response.status}): ${detail.slice(0, FIELD_LIMITS.providerErrorPreview)}`);
	}
}

/** Authentication / OTP template — body (+ optional copy-code button). */
export async function sendWhatsAppCloudOtp(input: {
	config: WhatsAppCloudConfig;
	toPhone: string;
	code: string;
	templateName?: string;
	languageCode?: string;
	includeCopyCodeButton?: boolean;
}): Promise<void> {
	const templateName = input.templateName?.trim() || process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || "authentication";
	const includeButton =
		input.includeCopyCodeButton ??
		(process.env.WHATSAPP_OTP_TEMPLATE_INCLUDES_BUTTON?.trim().toLowerCase() !== "0" &&
			process.env.WHATSAPP_OTP_TEMPLATE_INCLUDES_BUTTON?.trim().toLowerCase() !== "false");

	const components: TemplateComponent[] = [
		{
			type: "body",
			parameters: [{ type: "text", text: input.code }],
		},
	];
	if (includeButton) {
		components.push({
			type: "button",
			sub_type: "url",
			index: "0",
			parameters: [{ type: "text", text: input.code }],
		});
	}

	await sendWhatsAppCloudTemplate({
		config: input.config,
		toPhone: input.toPhone,
		templateName,
		languageCode: input.languageCode,
		components,
	});
}

/** Utility template with a single body parameter (staff alerts). */
export async function sendWhatsAppCloudUtilityText(input: {
	config: WhatsAppCloudConfig;
	toPhone: string;
	templateName: string;
	bodyText: string;
	languageCode?: string;
}): Promise<void> {
	const trimmed = input.bodyText.trim().slice(0, 900);
	await sendWhatsAppCloudTemplate({
		config: input.config,
		toPhone: input.toPhone,
		templateName: input.templateName,
		languageCode: input.languageCode,
		components: [
			{
				type: "body",
				parameters: [{ type: "text", text: trimmed }],
			},
		],
	});
}

export async function trySendWhatsAppCloudUtilityText(input: {
	toPhone: string;
	templateName: string;
	bodyText: string;
	languageCode?: string;
}): Promise<void> {
	let config = readWhatsAppCloudConfigFromEnv();
	if (!config) {
		try {
			const { getIntegrationSettings } = await import("@store/db");
			const { resolveWhatsAppCloudConfig } = await import("../integration/resolveIntegration");
			config = resolveWhatsAppCloudConfig(await getIntegrationSettings());
		} catch {
			return;
		}
	}
	if (!config) {
		return;
	}
	try {
		await sendWhatsAppCloudUtilityText({ config, ...input });
	} catch (error) {
		logger.warn({ error }, "WhatsApp Cloud utility message failed");
	}
}
