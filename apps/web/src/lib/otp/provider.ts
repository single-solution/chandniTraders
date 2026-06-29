/**
 * Pluggable OTP delivery provider.
 */

import { getIntegrationSettings } from "@store/db";
import { logger } from "@store/shared";

import { createMetaWhatsAppOtpProvider } from "@/lib/otp/metaWhatsAppProvider";

export interface OtpDeliveryRequest {
	phoneFingerprint: string;
	phoneRaw: string;
	code: string;
	expiresInMinutes: number;
	brand: string;
}

export interface OtpProvider {
	readonly id: string;
	send(request: OtpDeliveryRequest): Promise<void>;
}

const consoleProvider: OtpProvider = {
	id: "console",
	async send({ phoneRaw, code, expiresInMinutes, brand }) {
		logger.info(
			{
				phone: phoneRaw,
				code,
				expiresInMinutes,
				brand,
			},
			`[OTP] ${brand} verification code (dev provider — would deliver to ${phoneRaw})`,
		);
	},
};

export async function getOtpProvider(): Promise<OtpProvider> {
	const settings = await getIntegrationSettings();
	const explicit = settings.otpProvider === "auto" ? (process.env.OTP_PROVIDER ?? "").toLowerCase() : settings.otpProvider;

	if (explicit === "whatsapp-cloud" || explicit === "meta") {
		const meta = createMetaWhatsAppOtpProvider(settings);
		if (!meta) {
			throw new Error("WhatsApp Cloud OTP selected but credentials are missing in Admin → Integrations.");
		}
		return meta;
	}

	if (explicit === "console") {
		if (process.env.NODE_ENV === "production") {
			throw new Error("Console OTP provider is disabled in production. Configure Meta WhatsApp under Admin → Integrations.");
		}
		return consoleProvider;
	}

	const meta = createMetaWhatsAppOtpProvider(settings);
	if (meta) {
		logger.info({ provider: meta.id }, "OTP provider auto-selected");
		return meta;
	}

	if (process.env.NODE_ENV === "production") {
		throw new Error("OTP delivery is not configured. Add Meta WhatsApp credentials in Admin → Settings → Integrations.");
	}
	return consoleProvider;
}
