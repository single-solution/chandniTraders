/**
 * Server-side resolver for the `StoreSettings` contract declared in
 * `@store/shared`. Both apps go through this helper instead of reading
 * `STORE_SETTING_DEFAULTS` directly, so admin overrides actually flow
 * to the storefront at runtime.
 *
 * Caching strategy:
 *   - Process-local in-memory cache with a short TTL.
 *   - Each Next.js server process (storefront, admin) keeps its own copy.
 *   - When the admin saves a setting it calls `invalidateStoreSettingsCache`
 *     in-process; the storefront process picks up the change at most
 *     `CACHE_TTL_MS` later. Branding info doesn't change minute-to-minute,
 *     so eventual consistency is acceptable here.
 */

import {
	coerceStoreSettingValue,
	escapeRegex,
	fromStoreSettingKey,
	logger,
	MS_PER_MINUTE,
	STORE_SETTING_DEFAULTS,
	STORE_SETTING_KEY_PREFIX,
	type StoreSettings,
} from "@store/shared";

import { connectDB } from "./connection";
import { Setting } from "./models/Setting";

/** In-process cache TTL — eventual consistency is fine for branding/policy. */
const CACHE_TTL_MS = MS_PER_MINUTE;

interface CacheEntry {
	value: StoreSettings;
	expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<StoreSettings> | null = null;

interface SettingDocLean {
	key: string;
	value: unknown;
}

async function loadFromDb(): Promise<StoreSettings> {
	await connectDB();
	const docs = await Setting.find({
		key: { $regex: `^${escapeRegex(STORE_SETTING_KEY_PREFIX)}` },
	})
		.select({ key: 1, value: 1 })
		.lean<SettingDocLean[]>();

	const merged: StoreSettings = { ...STORE_SETTING_DEFAULTS };
	for (const doc of docs) {
		const field = fromStoreSettingKey(doc?.key ?? "");
		if (!field) {
			continue;
		}
		const coerced = coerceStoreSettingValue(field, doc?.value);
		if (coerced === null) {
			logger.warn({ key: doc?.key, value: doc?.value }, "store-settings: dropping invalid value, falling back to default");
			continue;
		}
		// Each field's coerced value is typed against `StoreSettings[K]`, so the
		// assignment is sound — TypeScript does not preserve `K`
		// through the `for…of` iteration.
		(merged[field] as StoreSettings[typeof field]) = coerced;
	}
	return merged;
}

/**
 * Resolve the current `StoreSettings` for the running process. Reads from a
 * short-lived in-memory cache; on a miss it dedupes concurrent loads so a
 * burst of requests doesn't trigger a thundering-herd of Mongo queries.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
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
			logger.error({ error }, "store-settings: load failed, returning factory defaults this request");
			return STORE_SETTING_DEFAULTS;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/**
 * Drop the in-memory cache. Call this from any code path that mutates a
 * `Setting` document so the next read in the same process reflects the
 * change immediately.
 */
export function invalidateStoreSettingsCache(): void {
	cache = null;
}
