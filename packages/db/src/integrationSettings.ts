import {
	coerceIntegrationSettingValue,
	escapeRegex,
	fromIntegrationSettingKey,
	logger,
	MS_PER_MINUTE,
	INTEGRATION_SETTING_DEFAULTS,
	mergeIntegrationSettingsFromDb,
	resolveIntegrationSettings,
	type IntegrationSettingsValues,
} from "@store/shared";

import { connectDB } from "./connection";
import { Setting } from "./models/Setting";

const CACHE_TTL_MS = MS_PER_MINUTE;

interface CacheEntry {
	value: IntegrationSettingsValues;
	expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<IntegrationSettingsValues> | null = null;

interface SettingDocLean {
	key: string;
	value: unknown;
}

const INTEGRATION_KEY_PREFIX = "integration.";

async function loadFromDb(): Promise<IntegrationSettingsValues> {
	await connectDB();
	const docs = await Setting.find({
		key: { $regex: `^${escapeRegex(INTEGRATION_KEY_PREFIX)}` },
	})
		.select({ key: 1, value: 1 })
		.lean<SettingDocLean[]>();

	const merged = mergeIntegrationSettingsFromDb(docs);
	return resolveIntegrationSettings(merged);
}

export async function getIntegrationSettings(): Promise<IntegrationSettingsValues> {
	if (cache && cache.expiresAt > Date.now()) {
		return cache.value;
	}

	if (inflight) {
		return inflight;
	}

	inflight = (async () => {
		try {
			const value = await loadFromDb();
			cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
			return value;
		} catch (error) {
			logger.error({ error }, "integration-settings: load failed, using env fallback");
			return resolveIntegrationSettings({ ...INTEGRATION_SETTING_DEFAULTS });
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

export function invalidateIntegrationSettingsCache(): void {
	cache = null;
}

export async function loadRawIntegrationSettingsFromDb(): Promise<IntegrationSettingsValues> {
	await connectDB();
	const docs = await Setting.find({
		key: { $regex: `^${escapeRegex(INTEGRATION_KEY_PREFIX)}` },
	})
		.select({ key: 1, value: 1 })
		.lean<SettingDocLean[]>();

	const merged: IntegrationSettingsValues = { ...INTEGRATION_SETTING_DEFAULTS };
	for (const doc of docs) {
		const field = fromIntegrationSettingKey(doc?.key ?? "");
		if (!field) {
			continue;
		}
		const coerced = coerceIntegrationSettingValue(field, doc?.value);
		if (coerced === null) {
			continue;
		}
		(merged[field] as IntegrationSettingsValues[typeof field]) = coerced;
	}
	return merged;
}
