import type { IntegrationSettingsValues, OnlinePaymentProvider } from "./integration/integrationSettingsSchema";
import { isOnlineCardCheckoutReady } from "./integration/resolveIntegration";

export type OtpRuntimeProviderId = "whatsapp-cloud" | "console";

export interface OtpIntegrationStatus {
	explicitProvider: string;
	activeProvider: OtpRuntimeProviderId;
	metaWhatsApp: {
		accessTokenConfigured: boolean;
		phoneNumberIdConfigured: boolean;
		otpTemplateName: string;
	};
	readyForProduction: boolean;
	summary: string;
}

export interface StorageIntegrationStatus {
	s3Configured: boolean;
	ready: boolean;
	summary: string;
}

export interface OnlinePaymentIntegrationStatus {
	provider: OnlinePaymentProvider;
	ready: boolean;
	payfastConfigured: boolean;
	rapidConfigured: boolean;
	webhookConfigured: boolean;
	summary: string;
}

export function readOtpIntegrationStatus(settings: IntegrationSettingsValues): OtpIntegrationStatus {
	const otpTemplateName = settings.whatsappOtpTemplateName.trim() || "authentication";
	// Meta WhatsApp Cloud OTP is not used on this deployment — codes go to server logs.
	return {
		explicitProvider: "console",
		activeProvider: "console",
		metaWhatsApp: {
			accessTokenConfigured: false,
			phoneNumberIdConfigured: false,
			otpTemplateName,
		},
		readyForProduction: false,
		summary: "OTP codes print to server logs (Meta WhatsApp Cloud is not enabled).",
	};
}

export function readStorageIntegrationStatus(settings: IntegrationSettingsValues): StorageIntegrationStatus {
	const s3Configured = Boolean(
		settings.awsS3Bucket.trim() &&
			settings.awsS3Region.trim() &&
			settings.awsAccessKeyId.trim() &&
			settings.awsSecretAccessKey.trim(),
	);
	const publicBaseConfigured = Boolean(settings.awsS3PublicUrlBase.trim());
	const usesCustomEndpoint = Boolean(settings.awsS3Endpoint.trim());
	const ready = s3Configured && (!usesCustomEndpoint || publicBaseConfigured);

	let summary = "Bucket, region, or credentials incomplete — uploads will fail.";
	if (s3Configured && usesCustomEndpoint && !publicBaseConfigured) {
		summary = "R2/S3 endpoint is set but AWS_S3_PUBLIC_URL_BASE is missing — uploads will use a broken URL.";
	} else if (ready) {
		summary = publicBaseConfigured
			? "Bucket configured via deploy env — uploads use your public CDN / R2.dev URL."
			: "Bucket configured — product and brand uploads use your S3 bucket.";
	}

	return {
		s3Configured,
		ready,
		summary,
	};
}

export function readOnlinePaymentIntegrationStatus(settings: IntegrationSettingsValues): OnlinePaymentIntegrationStatus {
	const ready = isOnlineCardCheckoutReady(settings);
	return {
		provider: "none",
		ready,
		payfastConfigured: false,
		rapidConfigured: false,
		webhookConfigured: false,
		summary: "Online card gateways are off — checkout uses bank transfer and/or cash on delivery.",
	};
}
