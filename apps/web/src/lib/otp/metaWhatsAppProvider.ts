/**
 * Meta WhatsApp Cloud API OTP provider (Business account).
 */

import { FIELD_LIMITS, logger, resolveWhatsAppCloudConfig, type IntegrationSettingsValues } from "@store/shared";
import { sendWhatsAppCloudOtp } from "@store/shared/server";

import type { OtpDeliveryRequest, OtpProvider } from "@/lib/otp/provider";

class MetaWhatsAppOtpProvider implements OtpProvider {
	readonly id = "whatsapp-cloud";

	constructor(private readonly settings: IntegrationSettingsValues) {}

	async send(request: OtpDeliveryRequest): Promise<void> {
		const config = resolveWhatsAppCloudConfig(this.settings);
		if (!config) {
			throw new Error("Meta WhatsApp Cloud API is not configured.");
		}

		try {
			await sendWhatsAppCloudOtp({
				config,
				toPhone: request.phoneRaw,
				code: request.code,
				templateName: this.settings.whatsappOtpTemplateName,
				includeCopyCodeButton: this.settings.whatsappOtpTemplateIncludesButton,
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			logger.error({ detail: detail.slice(0, FIELD_LIMITS.providerErrorPreview) }, "Meta WhatsApp OTP delivery failed");
			throw error;
		}
	}
}

export function createMetaWhatsAppOtpProvider(settings: IntegrationSettingsValues): OtpProvider | null {
	if (!resolveWhatsAppCloudConfig(settings)) {
		return null;
	}
	return new MetaWhatsAppOtpProvider(settings);
}
