import type { WhatsAppCloudConfig } from "../notifications/whatsappCloudApi";
import type { IntegrationSettingsValues } from "./integrationSettingsSchema";

function pickString(dbValue: string, envValue: string | undefined): string {
	const fromDb = dbValue.trim();
	if (fromDb) {
		return fromDb;
	}
	return envValue?.trim() ?? "";
}

/** Resolved credentials — DB settings win; env vars are bootstrap fallback.
 * Online gateways and Meta WhatsApp Cloud are disabled for this deployment. */
export function resolveIntegrationSettings(db: IntegrationSettingsValues): IntegrationSettingsValues {
	return {
		otpProvider: "console",
		whatsappCloudAccessToken: "",
		whatsappPhoneNumberId: "",
		whatsappOtpTemplateName: "authentication",
		whatsappCloudApiVersion: pickString(db.whatsappCloudApiVersion, process.env.WHATSAPP_CLOUD_API_VERSION) || "v21.0",
		whatsappOtpTemplateIncludesButton: db.whatsappOtpTemplateIncludesButton,

		smtpHost: pickString(db.smtpHost, process.env.SMTP_HOST),
		smtpPort: pickString(db.smtpPort, process.env.SMTP_PORT) || "587",
		smtpUser: pickString(db.smtpUser, process.env.SMTP_USER),
		smtpPass: pickString(db.smtpPass, process.env.SMTP_PASS),
		smtpFrom: pickString(db.smtpFrom, process.env.SMTP_FROM),
		staffNotifyEmail: pickString(db.staffNotifyEmail, process.env.STAFF_NOTIFY_EMAIL),
		staffNotifyWhatsApp: "",
		whatsappStaffNotifyTemplate: "",
		whatsappCustomerOrderTemplate: "",
		adminSiteUrl: pickString(db.adminSiteUrl, process.env.ADMIN_SITE_URL),

		onlinePaymentProvider: "none",
		payfastMerchantId: "",
		payfastSecuredKey: "",
		payfastMerchantName: "",
		payfastSandbox: true,
		rapidGatewaySecretKey: "",
		rapidGatewayWebhookSecret: "",
		rapidGatewaySandbox: true,

		awsS3Bucket: pickString(db.awsS3Bucket, process.env.AWS_S3_BUCKET),
		awsS3Region: pickString(db.awsS3Region, process.env.AWS_S3_REGION),
		awsAccessKeyId: pickString(db.awsAccessKeyId, process.env.AWS_ACCESS_KEY_ID),
		awsSecretAccessKey: pickString(db.awsSecretAccessKey, process.env.AWS_SECRET_ACCESS_KEY),
		awsS3PublicUrlBase: pickString(db.awsS3PublicUrlBase, process.env.AWS_S3_PUBLIC_URL_BASE),
		awsS3Endpoint: pickString(db.awsS3Endpoint, process.env.AWS_S3_ENDPOINT),
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

/** Online card checkout is not offered on this deployment. */
export function isOnlineCardCheckoutReady(_settings: IntegrationSettingsValues): boolean {
	return false;
}
