import { logger } from "../logger";
import type { IntegrationSettingsValues } from "../integration/integrationSettingsSchema";

export interface SendResendEmailInput {
	to: string;
	subject: string;
	text: string;
	from?: string;
	settings?: Pick<IntegrationSettingsValues, "resendApiKey" | "resendFromEmail">;
}

/** Send a plain-text email via Resend. Returns false when skipped or failed. */
export async function sendResendEmail(input: SendResendEmailInput): Promise<boolean> {
	let apiKey = input.settings?.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim();
	let fromDefault = input.settings?.resendFromEmail?.trim() || process.env.RESEND_FROM_EMAIL?.trim();

	if (!apiKey || !fromDefault) {
		try {
			const { getIntegrationSettings } = await import("@store/db");
			const integration = await getIntegrationSettings();
			apiKey = apiKey || integration.resendApiKey.trim();
			fromDefault = fromDefault || integration.resendFromEmail.trim();
		} catch (error) {
			logger.warn({ error }, "Resend: could not load integration settings");
		}
	}

	const to = input.to.trim();
	if (!apiKey || !to) {
		return false;
	}

	const from = input.from?.trim() || fromDefault || "onboarding@resend.dev";

	try {
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [to],
				subject: input.subject,
				text: input.text,
			}),
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			logger.warn({ status: response.status, detail: detail.slice(0, 200) }, "Resend email failed");
			return false;
		}

		return true;
	} catch (error) {
		logger.warn({ error }, "Resend email request failed");
		return false;
	}
}
