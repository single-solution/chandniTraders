/**
 * Typed bulk read/write for `chat.*` inquiry widget settings.
 */

import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { connectDB, handleMongoError, invalidateStoreSettingsCache, Setting } from "@store/db";
import {
	badRequest,
	CHAT_ASSISTANT_DEFAULT_MODELS,
	CHAT_SETTING_DEFAULTS,
	CHAT_SETTING_KEYS,
	CHAT_SETTING_DB_KEY_LIST,
	coerceChatSettingValue,
	isAssistantProviderConfigured,
	mergeChatSettingsFromDb,
	mergeIntegrationSecretUpdate,
	ok,
	parseBody,
	resolveAssistantModelFromSettings,
	toChatSettingKey,
	toAdminChatSettings,
	type ChatSettingsValues,
} from "@store/shared";

import type { SettingLean } from "@/lib/serializers/setting";

function buildProviderStatus(settings: ChatSettingsValues) {
	return {
		openai: {
			configured: isAssistantProviderConfigured("openai", settings.providerApiKeyOpenai),
			model: resolveAssistantModelFromSettings("openai", settings),
			defaultModel: CHAT_ASSISTANT_DEFAULT_MODELS.openai,
			dbModel: settings.assistantModelOpenai,
		},
		google: {
			configured: isAssistantProviderConfigured("google", settings.providerApiKeyGoogle),
			model: resolveAssistantModelFromSettings("google", settings),
			defaultModel: CHAT_ASSISTANT_DEFAULT_MODELS.google,
			dbModel: settings.assistantModelGoogle,
		},
		anthropic: {
			configured: isAssistantProviderConfigured("anthropic", settings.providerApiKeyAnthropic),
			model: resolveAssistantModelFromSettings("anthropic", settings),
			defaultModel: CHAT_ASSISTANT_DEFAULT_MODELS.anthropic,
			dbModel: settings.assistantModelAnthropic,
		},
	};
}

export async function GET() {
	const { response } = await requireSession("settings_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const docs = await Setting.find({ key: { $in: CHAT_SETTING_DB_KEY_LIST } })
			.select({ key: 1, value: 1 })
			.lean<SettingLean[]>();

		const settings = mergeChatSettingsFromDb(docs);

		return ok({
			settings: toAdminChatSettings(settings),
			providers: buildProviderStatus(settings),
		});
	} catch (error) {
		return handleMongoError(error);
	}
}

type PutBody = Partial<Record<keyof ChatSettingsValues, unknown>>;

export async function PUT(request: Request) {
	const { actor, response } = await requireSession("settings_update");
	if (response) {
		return response;
	}

	const body = await parseBody<PutBody>(request);
	if (body instanceof Response) {
		return body;
	}

	const updates: Array<{
		field: keyof ChatSettingsValues;
		value: ChatSettingsValues[keyof ChatSettingsValues];
	}> = [];

	await connectDB();
	const existing = mergeChatSettingsFromDb(
		await Setting.find({ key: { $in: CHAT_SETTING_DB_KEY_LIST } })
			.select({ key: 1, value: 1 })
			.lean<SettingLean[]>(),
	);

	const secretFields = new Set<keyof ChatSettingsValues>(["providerApiKeyOpenai", "providerApiKeyGoogle", "providerApiKeyAnthropic"]);

	for (const field of CHAT_SETTING_KEYS) {
		if (!(field in body)) {
			continue;
		}
		let incoming = body[field];
		if (secretFields.has(field) && typeof incoming === "string") {
			incoming = mergeIntegrationSecretUpdate(
				field as Parameters<typeof mergeIntegrationSecretUpdate>[0],
				incoming,
				existing[field] as string,
			);
		}
		const coerced = coerceChatSettingValue(field, incoming);
		if (coerced === null) {
			return badRequest(`Invalid value for "${field}".`);
		}
		updates.push({ field, value: coerced });
	}

	if (updates.length === 0) {
		return badRequest("No recognised inquiry settings fields supplied.");
	}

	try {
		await Promise.all(
			updates.map(({ field, value }) =>
				Setting.findOneAndUpdate(
					{ key: toChatSettingKey(field) },
					{
						$set: {
							key: toChatSettingKey(field),
							value,
							group: "chat",
							updatedBy: actor.id,
						},
					},
					{ upsert: true, runValidators: true, setDefaultsOnInsert: true },
				),
			),
		);

		invalidateStoreSettingsCache();
		bustAdminCaches();

		void recordActivity({
			actor,
			action: "updated",
			resourceType: "settings",
			resourceId: "chat",
			resourceLabel: "Inquiry settings",
			detail: updates.map(({ field }) => field).join(", "),
		});

		const docs = await Setting.find({ key: { $in: CHAT_SETTING_DB_KEY_LIST } })
			.select({ key: 1, value: 1 })
			.lean<SettingLean[]>();

		const settings = mergeChatSettingsFromDb(docs);

		return ok({
			settings: toAdminChatSettings(settings),
			providers: buildProviderStatus(settings),
		});
	} catch (error) {
		return handleMongoError(error);
	}
}

export { CHAT_SETTING_DEFAULTS };
