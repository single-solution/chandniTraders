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
	provider: string;
	tokenConfigured: boolean;
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
	const explicit =
		settings.otpProvider === "auto"
			? (process.env.OTP_PROVIDER ?? "").trim().toLowerCase()
			: settings.otpProvider;
	const metaAccessConfigured = Boolean(settings.whatsappCloudAccessToken.trim());
	const metaPhoneIdConfigured = Boolean(settings.whatsappPhoneNumberId.trim());
	const metaReady = metaAccessConfigured && metaPhoneIdConfigured;
	const otpTemplateName = settings.whatsappOtpTemplateName.trim() || "authentication";

	let activeProvider: OtpRuntimeProviderId = "console";

	if (explicit === "whatsapp-cloud" || explicit === "meta") {
		activeProvider = metaReady ? "whatsapp-cloud" : "console";
	} else if (explicit === "console") {
		activeProvider = "console";
	} else if (metaReady) {
		activeProvider = "whatsapp-cloud";
	}

	const readyForProduction = activeProvider === "whatsapp-cloud";

	let summary = "Console provider — codes print to server logs (development only).";
	if (explicit === "whatsapp-cloud" && !metaReady) {
		summary = "WhatsApp Cloud selected but access token or phone number ID is missing.";
	} else if (activeProvider === "whatsapp-cloud") {
		summary = `Meta WhatsApp Cloud API active — OTP template "${otpTemplateName}".`;
	}

	return {
		explicitProvider: explicit || "(auto)",
		activeProvider,
		metaWhatsApp: {
			accessTokenConfigured: metaAccessConfigured,
			phoneNumberIdConfigured: metaPhoneIdConfigured,
			otpTemplateName,
		},
		readyForProduction,
		summary,
	};
}

export function readStorageIntegrationStatus(settings: IntegrationSettingsValues): StorageIntegrationStatus {
	const provider = settings.storageProvider;
	const tokenConfigured = Boolean(settings.blobReadWriteToken.trim());
	const s3Configured = Boolean(
		settings.awsS3Bucket.trim() &&
			settings.awsS3Region.trim() &&
			settings.awsAccessKeyId.trim() &&
			settings.awsSecretAccessKey.trim(),
	);

	let ready = false;
	let summary = "Vercel Blob token missing — uploads will fail.";

	if (provider === "s3") {
		ready = s3Configured;
		summary = s3Configured
			? "S3 configured — product and brand uploads use your bucket."
			: "S3 selected but bucket, region, or credentials are incomplete.";
	} else if (tokenConfigured) {
		ready = true;
		summary = "Vercel Blob configured — product and brand uploads work.";
	}

	return {
		provider,
		tokenConfigured,
		s3Configured,
		ready,
		summary,
	};
}

export function readOnlinePaymentIntegrationStatus(settings: IntegrationSettingsValues): OnlinePaymentIntegrationStatus {
	const provider = settings.onlinePaymentProvider;
	const payfastConfigured = Boolean(settings.payfastMerchantId.trim() && settings.payfastSecuredKey.trim());
	const rapidConfigured = Boolean(settings.rapidGatewaySecretKey.trim());
	const webhookConfigured =
		provider === "rapid-gateway"
			? Boolean(settings.rapidGatewayWebhookSecret.trim())
			: provider === "payfast"
				? payfastConfigured
				: false;
	const ready = isOnlineCardCheckoutReady(settings);

	let summary = "No online gateway — bank transfer and COD are active. Pick PayFast or Rapid Gateway below.";
	if (provider === "payfast" && !payfastConfigured) {
		summary = "PayFast selected but merchant ID or secured key is missing.";
	} else if (provider === "payfast" && ready) {
		summary = `PayFast ready${settings.payfastSandbox ? " (sandbox)" : " (live)"} — cards and wallets on hosted checkout.`;
	} else if (provider === "rapid-gateway" && !rapidConfigured) {
		summary = "Rapid Gateway selected but secret key is missing.";
	} else if (provider === "rapid-gateway" && ready && !settings.rapidGatewayWebhookSecret.trim()) {
		summary = "Rapid Gateway checkout works — add webhook secret so paid orders auto-confirm.";
	} else if (provider === "rapid-gateway" && ready) {
		summary = `Rapid Gateway ready${settings.rapidGatewaySandbox ? " (sandbox)" : " (live)"} — cards, JazzCash, easypaisa.`;
	}

	return {
		provider,
		ready,
		payfastConfigured,
		rapidConfigured,
		webhookConfigured,
		summary,
	};
}
