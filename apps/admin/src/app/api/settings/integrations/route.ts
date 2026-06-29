import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import {
	connectDB,
	getIntegrationSettings,
	handleMongoError,
	invalidateIntegrationSettingsCache,
	loadRawIntegrationSettingsFromDb,
	Setting,
} from "@store/db";
import {
	badRequest,
	INTEGRATION_SETTING_KEYS,
	INTEGRATION_SETTING_DB_KEY_LIST,
	coerceIntegrationSettingValue,
	mergeIntegrationSecretUpdate,
	mergeIntegrationSettingsFromDb,
	ok,
	parseBody,
	readOtpIntegrationStatus,
	readStorageIntegrationStatus,
	readOnlinePaymentIntegrationStatus,
	toAdminIntegrationSettings,
	toIntegrationSettingKey,
	type IntegrationSettingsValues,
} from "@store/shared";

import type { SettingLean } from "@/lib/serializers/setting";

export async function GET() {
	const { response } = await requireSession("settings_view");
	if (response) {
		return response;
	}

	try {
		const resolved = await getIntegrationSettings();
		const raw = await loadRawIntegrationSettingsFromDb();

		return ok({
			settings: toAdminIntegrationSettings(raw),
			status: {
				otp: readOtpIntegrationStatus(resolved),
				storage: readStorageIntegrationStatus(resolved),
				onlinePayment: readOnlinePaymentIntegrationStatus(resolved),
			},
		});
	} catch (error) {
		return handleMongoError(error);
	}
}

type PutBody = Partial<Record<keyof IntegrationSettingsValues, unknown>>;

export async function PUT(request: Request) {
	const { actor, response } = await requireSession("settings_update");
	if (response) {
		return response;
	}

	const body = await parseBody<PutBody>(request);
	if (body instanceof Response) {
		return body;
	}

	const existing = await loadRawIntegrationSettingsFromDb();
	const updates: Array<{
		field: keyof IntegrationSettingsValues;
		value: IntegrationSettingsValues[keyof IntegrationSettingsValues];
	}> = [];

	const secretFields = new Set<keyof IntegrationSettingsValues>([
		"whatsappCloudAccessToken",
		"resendApiKey",
		"payfastSecuredKey",
		"rapidGatewaySecretKey",
		"rapidGatewayWebhookSecret",
		"blobReadWriteToken",
		"awsSecretAccessKey",
	]);

	for (const field of INTEGRATION_SETTING_KEYS) {
		if (!(field in body)) {
			continue;
		}
		let incoming = body[field];
		if (secretFields.has(field) && typeof incoming === "string") {
			incoming = mergeIntegrationSecretUpdate(field, incoming, existing[field] as string);
		}
		const coerced = coerceIntegrationSettingValue(field, incoming);
		if (coerced === null) {
			return badRequest(`Invalid value for "${field}".`);
		}
		updates.push({ field, value: coerced });
	}

	if (updates.length === 0) {
		return badRequest("No recognised integration fields supplied.");
	}

	await connectDB();
	try {
		await Promise.all(
			updates.map(({ field, value }) =>
				Setting.findOneAndUpdate(
					{ key: toIntegrationSettingKey(field) },
					{
						$set: {
							key: toIntegrationSettingKey(field),
							value,
							group: "integration",
							updatedBy: actor.id,
						},
					},
					{ upsert: true, runValidators: true, setDefaultsOnInsert: true },
				),
			),
		);

		invalidateIntegrationSettingsCache();
		bustAdminCaches();

		void recordActivity({
			actor,
			action: "updated",
			resourceType: "settings",
			resourceId: "integration",
			resourceLabel: "Integration credentials",
			detail: updates.map(({ field }) => field).join(", "),
		});

		const resolved = await getIntegrationSettings();
		const raw = mergeIntegrationSettingsFromDb(
			await Setting.find({ key: { $in: INTEGRATION_SETTING_DB_KEY_LIST } })
				.select({ key: 1, value: 1 })
				.lean<SettingLean[]>(),
		);

		return ok({
			settings: toAdminIntegrationSettings(raw),
			status: {
				otp: readOtpIntegrationStatus(resolved),
				storage: readStorageIntegrationStatus(resolved),
				onlinePayment: readOnlinePaymentIntegrationStatus(resolved),
			},
		});
	} catch (error) {
		return handleMongoError(error);
	}
}
