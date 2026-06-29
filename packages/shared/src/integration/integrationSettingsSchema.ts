/** Server-managed integration credentials — editable in Admin → Settings → Integrations. */

export type IntegrationOtpProvider = "auto" | "whatsapp-cloud" | "console";

export type IntegrationStorageProvider = "vercel-blob" | "s3";

/** Pakistan online payment gateway — admin picks one active provider. */
export type OnlinePaymentProvider = "none" | "payfast" | "rapid-gateway";

export const ONLINE_PAYMENT_PROVIDERS = ["none", "payfast", "rapid-gateway"] as const;

export interface IntegrationSettingsValues {
	otpProvider: IntegrationOtpProvider;
	whatsappCloudAccessToken: string;
	whatsappPhoneNumberId: string;
	whatsappOtpTemplateName: string;
	whatsappCloudApiVersion: string;
	whatsappOtpTemplateIncludesButton: boolean;

	resendApiKey: string;
	resendFromEmail: string;
	staffNotifyEmail: string;
	staffNotifyWhatsApp: string;
	whatsappStaffNotifyTemplate: string;
	whatsappCustomerOrderTemplate: string;
	adminSiteUrl: string;

	onlinePaymentProvider: OnlinePaymentProvider;
	payfastMerchantId: string;
	payfastSecuredKey: string;
	payfastMerchantName: string;
	payfastSandbox: boolean;
	rapidGatewaySecretKey: string;
	rapidGatewayWebhookSecret: string;
	rapidGatewaySandbox: boolean;

	storageProvider: IntegrationStorageProvider;
	blobReadWriteToken: string;
	awsS3Bucket: string;
	awsS3Region: string;
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	awsS3PublicUrlBase: string;
}

export const INTEGRATION_SETTING_DEFAULTS: IntegrationSettingsValues = {
	otpProvider: "auto",
	whatsappCloudAccessToken: "",
	whatsappPhoneNumberId: "",
	whatsappOtpTemplateName: "authentication",
	whatsappCloudApiVersion: "v21.0",
	whatsappOtpTemplateIncludesButton: true,

	resendApiKey: "",
	resendFromEmail: "",
	staffNotifyEmail: "",
	staffNotifyWhatsApp: "",
	whatsappStaffNotifyTemplate: "",
	whatsappCustomerOrderTemplate: "",
	adminSiteUrl: "",

	onlinePaymentProvider: "none",
	payfastMerchantId: "",
	payfastSecuredKey: "",
	payfastMerchantName: "",
	payfastSandbox: true,
	rapidGatewaySecretKey: "",
	rapidGatewayWebhookSecret: "",
	rapidGatewaySandbox: true,

	storageProvider: "vercel-blob",
	blobReadWriteToken: "",
	awsS3Bucket: "",
	awsS3Region: "",
	awsAccessKeyId: "",
	awsSecretAccessKey: "",
	awsS3PublicUrlBase: "",
};

export const INTEGRATION_SETTING_KEYS = Object.keys(INTEGRATION_SETTING_DEFAULTS) as Array<keyof IntegrationSettingsValues>;

const INTEGRATION_SETTING_DB_KEYS: Record<keyof IntegrationSettingsValues, string> = {
	otpProvider: "integration.otpProvider",
	whatsappCloudAccessToken: "integration.whatsappCloudAccessToken",
	whatsappPhoneNumberId: "integration.whatsappPhoneNumberId",
	whatsappOtpTemplateName: "integration.whatsappOtpTemplateName",
	whatsappCloudApiVersion: "integration.whatsappCloudApiVersion",
	whatsappOtpTemplateIncludesButton: "integration.whatsappOtpTemplateIncludesButton",

	resendApiKey: "integration.resendApiKey",
	resendFromEmail: "integration.resendFromEmail",
	staffNotifyEmail: "integration.staffNotifyEmail",
	staffNotifyWhatsApp: "integration.staffNotifyWhatsApp",
	whatsappStaffNotifyTemplate: "integration.whatsappStaffNotifyTemplate",
	whatsappCustomerOrderTemplate: "integration.whatsappCustomerOrderTemplate",
	adminSiteUrl: "integration.adminSiteUrl",

	onlinePaymentProvider: "integration.onlinePaymentProvider",
	payfastMerchantId: "integration.payfastMerchantId",
	payfastSecuredKey: "integration.payfastSecuredKey",
	payfastMerchantName: "integration.payfastMerchantName",
	payfastSandbox: "integration.payfastSandbox",
	rapidGatewaySecretKey: "integration.rapidGatewaySecretKey",
	rapidGatewayWebhookSecret: "integration.rapidGatewayWebhookSecret",
	rapidGatewaySandbox: "integration.rapidGatewaySandbox",

	storageProvider: "integration.storageProvider",
	blobReadWriteToken: "integration.blobReadWriteToken",
	awsS3Bucket: "integration.awsS3Bucket",
	awsS3Region: "integration.awsS3Region",
	awsAccessKeyId: "integration.awsAccessKeyId",
	awsSecretAccessKey: "integration.awsSecretAccessKey",
	awsS3PublicUrlBase: "integration.awsS3PublicUrlBase",
};

export const INTEGRATION_SETTING_DB_KEY_LIST = Object.values(INTEGRATION_SETTING_DB_KEYS);

export function toIntegrationSettingKey(field: keyof IntegrationSettingsValues): string {
	return INTEGRATION_SETTING_DB_KEYS[field];
}

export function fromIntegrationSettingKey(key: string): keyof IntegrationSettingsValues | null {
	for (const field of INTEGRATION_SETTING_KEYS) {
		if (INTEGRATION_SETTING_DB_KEYS[field] === key) {
			return field;
		}
	}
	return null;
}

function trimSecret(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") {
		return null;
	}
	return value.trim().slice(0, maxLength);
}

export function coerceIntegrationSettingValue<K extends keyof IntegrationSettingsValues>(
	field: K,
	value: unknown,
): IntegrationSettingsValues[K] | null {
	switch (field) {
		case "otpProvider":
			if (value === "auto" || value === "whatsapp-cloud" || value === "console") {
				return value as IntegrationSettingsValues[K];
			}
			return null;
		case "storageProvider":
			if (value === "vercel-blob" || value === "s3") {
				return value as IntegrationSettingsValues[K];
			}
			return null;
		case "whatsappOtpTemplateIncludesButton":
		case "payfastSandbox":
		case "rapidGatewaySandbox":
			if (typeof value === "boolean") {
				return value as IntegrationSettingsValues[K];
			}
			if (value === "true") {
				return true as IntegrationSettingsValues[K];
			}
			if (value === "false") {
				return false as IntegrationSettingsValues[K];
			}
			return null;
		case "onlinePaymentProvider":
			if (value === "none" || value === "payfast" || value === "rapid-gateway") {
				return value as IntegrationSettingsValues[K];
			}
			return null;
		case "whatsappCloudAccessToken":
			return trimSecret(value, 4_000) as IntegrationSettingsValues[K] | null;
		case "whatsappPhoneNumberId":
		case "whatsappOtpTemplateName":
		case "whatsappCloudApiVersion":
		case "resendFromEmail":
		case "whatsappStaffNotifyTemplate":
		case "whatsappCustomerOrderTemplate":
			return trimSecret(value, 200) as IntegrationSettingsValues[K] | null;
		case "resendApiKey":
		case "payfastSecuredKey":
		case "rapidGatewaySecretKey":
		case "rapidGatewayWebhookSecret":
		case "blobReadWriteToken":
		case "awsSecretAccessKey":
			return trimSecret(value, 500) as IntegrationSettingsValues[K] | null;
		case "staffNotifyEmail":
		case "adminSiteUrl":
		case "awsS3PublicUrlBase":
			return trimSecret(value, 500) as IntegrationSettingsValues[K] | null;
		case "staffNotifyWhatsApp":
			return trimSecret(value, 32) as IntegrationSettingsValues[K] | null;
		case "payfastMerchantId":
		case "payfastMerchantName":
			return trimSecret(value, 200) as IntegrationSettingsValues[K] | null;
		case "awsS3Bucket":
		case "awsS3Region":
		case "awsAccessKeyId":
			return trimSecret(value, 120) as IntegrationSettingsValues[K] | null;
		default:
			return null;
	}
}

function readIntegrationSetting<K extends keyof IntegrationSettingsValues>(
	map: Map<string, unknown>,
	field: K,
): IntegrationSettingsValues[K] {
	const coerced = coerceIntegrationSettingValue(field, map.get(toIntegrationSettingKey(field)));
	return (coerced ?? INTEGRATION_SETTING_DEFAULTS[field]) as IntegrationSettingsValues[K];
}

export function mergeIntegrationSettingsFromDb(rows: ReadonlyArray<{ key: string; value: unknown }>): IntegrationSettingsValues {
	const map = new Map(rows.map((row) => [row.key, row.value]));
	return {
		otpProvider: readIntegrationSetting(map, "otpProvider"),
		whatsappCloudAccessToken: readIntegrationSetting(map, "whatsappCloudAccessToken"),
		whatsappPhoneNumberId: readIntegrationSetting(map, "whatsappPhoneNumberId"),
		whatsappOtpTemplateName: readIntegrationSetting(map, "whatsappOtpTemplateName"),
		whatsappCloudApiVersion: readIntegrationSetting(map, "whatsappCloudApiVersion"),
		whatsappOtpTemplateIncludesButton: readIntegrationSetting(map, "whatsappOtpTemplateIncludesButton"),
		resendApiKey: readIntegrationSetting(map, "resendApiKey"),
		resendFromEmail: readIntegrationSetting(map, "resendFromEmail"),
		staffNotifyEmail: readIntegrationSetting(map, "staffNotifyEmail"),
		staffNotifyWhatsApp: readIntegrationSetting(map, "staffNotifyWhatsApp"),
		whatsappStaffNotifyTemplate: readIntegrationSetting(map, "whatsappStaffNotifyTemplate"),
		whatsappCustomerOrderTemplate: readIntegrationSetting(map, "whatsappCustomerOrderTemplate"),
		adminSiteUrl: readIntegrationSetting(map, "adminSiteUrl"),
		onlinePaymentProvider: readIntegrationSetting(map, "onlinePaymentProvider"),
		payfastMerchantId: readIntegrationSetting(map, "payfastMerchantId"),
		payfastSecuredKey: readIntegrationSetting(map, "payfastSecuredKey"),
		payfastMerchantName: readIntegrationSetting(map, "payfastMerchantName"),
		payfastSandbox: readIntegrationSetting(map, "payfastSandbox"),
		rapidGatewaySecretKey: readIntegrationSetting(map, "rapidGatewaySecretKey"),
		rapidGatewayWebhookSecret: readIntegrationSetting(map, "rapidGatewayWebhookSecret"),
		rapidGatewaySandbox: readIntegrationSetting(map, "rapidGatewaySandbox"),
		storageProvider: readIntegrationSetting(map, "storageProvider"),
		blobReadWriteToken: readIntegrationSetting(map, "blobReadWriteToken"),
		awsS3Bucket: readIntegrationSetting(map, "awsS3Bucket"),
		awsS3Region: readIntegrationSetting(map, "awsS3Region"),
		awsAccessKeyId: readIntegrationSetting(map, "awsAccessKeyId"),
		awsSecretAccessKey: readIntegrationSetting(map, "awsSecretAccessKey"),
		awsS3PublicUrlBase: readIntegrationSetting(map, "awsS3PublicUrlBase"),
	};
}

/** Mask secrets before sending integration settings to the admin browser. */
export function toAdminIntegrationSettings(settings: IntegrationSettingsValues): IntegrationSettingsValues {
	return {
		...settings,
		whatsappCloudAccessToken: maskSecret(settings.whatsappCloudAccessToken),
		resendApiKey: maskSecret(settings.resendApiKey),
		payfastSecuredKey: maskSecret(settings.payfastSecuredKey),
		rapidGatewaySecretKey: maskSecret(settings.rapidGatewaySecretKey),
		rapidGatewayWebhookSecret: maskSecret(settings.rapidGatewayWebhookSecret),
		blobReadWriteToken: maskSecret(settings.blobReadWriteToken),
		awsSecretAccessKey: maskSecret(settings.awsSecretAccessKey),
	};
}

function maskSecret(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}
	if (trimmed.length <= 8) {
		return "••••••••";
	}
	return `${"•".repeat(Math.min(12, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

/** Preserve existing secret when admin submits a masked placeholder. */
export function mergeIntegrationSecretUpdate(
	field: keyof IntegrationSettingsValues,
	incoming: string,
	existing: string,
): string {
	const trimmed = incoming.trim();
	if (!trimmed || trimmed.includes("•")) {
		return existing;
	}
	return trimmed;
}
