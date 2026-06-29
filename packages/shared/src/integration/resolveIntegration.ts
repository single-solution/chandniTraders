import type { WhatsAppCloudConfig } from "../notifications/whatsappCloudApi";
import type { IntegrationSettingsValues, OnlinePaymentProvider } from "./integrationSettingsSchema";

function pickString(dbValue: string, envValue: string | undefined): string {
	const fromDb = dbValue.trim();
	if (fromDb) {
		return fromDb;
	}
	return envValue?.trim() ?? "";
}

function pickBoolean(dbValue: boolean, envValue: string | undefined, fallback: boolean): boolean {
	if (envValue?.trim()) {
		return envValue.trim().toLowerCase() === "true";
	}
	return dbValue ?? fallback;
}

/** Resolved credentials — DB settings win; env vars are dev/bootstrap fallback. */
export function resolveIntegrationSettings(db: IntegrationSettingsValues): IntegrationSettingsValues {
	const envProvider = (process.env.ONLINE_PAYMENT_PROVIDER?.trim().toLowerCase() ?? "") as OnlinePaymentProvider;
	const resolvedProvider: OnlinePaymentProvider =
		db.onlinePaymentProvider !== "none"
			? db.onlinePaymentProvider
			: envProvider === "payfast" || envProvider === "rapid-gateway"
				? envProvider
				: "none";

	return {
		otpProvider: db.otpProvider,
		whatsappCloudAccessToken: pickString(db.whatsappCloudAccessToken, process.env.WHATSAPP_CLOUD_ACCESS_TOKEN),
		whatsappPhoneNumberId: pickString(db.whatsappPhoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID),
		whatsappOtpTemplateName:
			pickString(db.whatsappOtpTemplateName, process.env.WHATSAPP_OTP_TEMPLATE_NAME) || "authentication",
		whatsappCloudApiVersion: pickString(db.whatsappCloudApiVersion, process.env.WHATSAPP_CLOUD_API_VERSION) || "v21.0",
		whatsappOtpTemplateIncludesButton: db.whatsappOtpTemplateIncludesButton,

		resendApiKey: pickString(db.resendApiKey, process.env.RESEND_API_KEY),
		resendFromEmail: pickString(db.resendFromEmail, process.env.RESEND_FROM_EMAIL),
		staffNotifyEmail: pickString(db.staffNotifyEmail, process.env.STAFF_NOTIFY_EMAIL),
		staffNotifyWhatsApp: pickString(db.staffNotifyWhatsApp, process.env.STAFF_NOTIFY_WHATSAPP),
		whatsappStaffNotifyTemplate: pickString(db.whatsappStaffNotifyTemplate, process.env.WHATSAPP_STAFF_NOTIFY_TEMPLATE),
		whatsappCustomerOrderTemplate: pickString(db.whatsappCustomerOrderTemplate, process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE),
		adminSiteUrl: pickString(db.adminSiteUrl, process.env.ADMIN_SITE_URL),

		onlinePaymentProvider: resolvedProvider,
		payfastMerchantId: pickString(db.payfastMerchantId, process.env.PAYFAST_MERCHANT_ID),
		payfastSecuredKey: pickString(db.payfastSecuredKey, process.env.PAYFAST_SECURED_KEY),
		payfastMerchantName: pickString(db.payfastMerchantName, process.env.PAYFAST_MERCHANT_NAME),
		payfastSandbox: pickBoolean(db.payfastSandbox, process.env.PAYFAST_SANDBOX, true),
		rapidGatewaySecretKey: pickString(db.rapidGatewaySecretKey, process.env.RAPID_GATEWAY_SECRET_KEY),
		rapidGatewayWebhookSecret: pickString(db.rapidGatewayWebhookSecret, process.env.RAPID_GATEWAY_WEBHOOK_SECRET),
		rapidGatewaySandbox: pickBoolean(db.rapidGatewaySandbox, process.env.RAPID_GATEWAY_SANDBOX, true),

		storageProvider:
			db.storageProvider ||
			((process.env.STORAGE_PROVIDER?.trim().toLowerCase().replace(/_/g, "-") as IntegrationSettingsValues["storageProvider"] | undefined) ??
				"vercel-blob"),
		blobReadWriteToken: pickString(db.blobReadWriteToken, process.env.BLOB_READ_WRITE_TOKEN),
		awsS3Bucket: pickString(db.awsS3Bucket, process.env.AWS_S3_BUCKET),
		awsS3Region: pickString(db.awsS3Region, process.env.AWS_S3_REGION),
		awsAccessKeyId: pickString(db.awsAccessKeyId, process.env.AWS_ACCESS_KEY_ID),
		awsSecretAccessKey: pickString(db.awsSecretAccessKey, process.env.AWS_SECRET_ACCESS_KEY),
		awsS3PublicUrlBase: pickString(db.awsS3PublicUrlBase, process.env.AWS_S3_PUBLIC_URL_BASE),
	};
}

export function resolveWhatsAppCloudConfig(settings: IntegrationSettingsValues): WhatsAppCloudConfig | null {
	const accessToken = settings.whatsappCloudAccessToken.trim();
	const phoneNumberId = settings.whatsappPhoneNumberId.trim();
	if (!accessToken || !phoneNumberId) {
		return null;
	}
	return {
		accessToken,
		phoneNumberId,
		apiVersion: settings.whatsappCloudApiVersion.trim() || "v21.0",
	};
}

/** True when admin selected a PK gateway and required credentials are present. */
export function isOnlineCardCheckoutReady(settings: IntegrationSettingsValues): boolean {
	if (settings.onlinePaymentProvider === "payfast") {
		return Boolean(settings.payfastMerchantId.trim() && settings.payfastSecuredKey.trim());
	}
	if (settings.onlinePaymentProvider === "rapid-gateway") {
		return Boolean(settings.rapidGatewaySecretKey.trim());
	}
	return false;
}
