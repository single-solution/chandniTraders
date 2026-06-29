/**
 * Typed bulk read/write for the canonical `StoreSettings` shape (siteName,
 * support contacts, social links, policy thresholds). Sits alongside the
 * key-value `/api/settings` endpoint — that one keeps stretching to anything
 * key-value, this one is what the admin UI actually drives.
 *
 * GET   → returns merged settings (DB overrides layered on factory defaults).
 * PUT   → accepts a partial `StoreSettings` body, validates each field
 *         against its expected runtime type, persists overrides, and
 *         invalidates the in-process cache so the next read is fresh.
 */
import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { connectDB, getStoreSettings, handleMongoError, invalidateStoreSettingsCache, Setting } from "@store/db";
import {
	badRequest,
	coerceStoreSettingValue,
	groupForField,
	isValidWhatsappNumber,
	normalizeWhatsappNumber,
	ok,
	POLICY_HTML_MAX_LENGTH,
	parseBody,
	STORE_SETTING_DEFAULTS,
	STORE_SETTING_KEYS,
	toStoreSettingKey,
	type StoreSettings,
} from "@store/shared";

const LOW_STOCK_THRESHOLD_MAX = 1000;
const META_PIXEL_REGEX = /^\d{6,20}$/;
const GA_REGEX = /^G-[A-Z0-9]{4,20}$/;
const GTM_REGEX = /^GTM-[A-Z0-9]{4,12}$/;
const TIKTOK_PIXEL_REGEX = /^[A-Z0-9]{16,40}$/;

export async function GET() {
	const { response } = await requireSession("settings_view");
	if (response) {
		return response;
	}

	const settings = await getStoreSettings();
	return ok({ settings });
}

type PutBody = Partial<Record<keyof StoreSettings, unknown>>;

export async function PUT(request: Request) {
	const { actor, response } = await requireSession("settings_update");
	if (response) {
		return response;
	}

	const body = await parseBody<PutBody>(request);
	if (body instanceof Response) {
		return body;
	}

	const updates: Array<{ field: keyof StoreSettings; value: StoreSettings[keyof StoreSettings] }> = [];
	for (const field of STORE_SETTING_KEYS) {
		if (!(field in body)) {
			continue;
		}
		const raw = body[field];
		const coerced = coerceStoreSettingValue(field, raw);
		if (coerced === null) {
			const expectedType = typeof STORE_SETTING_DEFAULTS[field];
			return badRequest(`"${field}" must be a ${expectedType}.`);
		}
		let value: StoreSettings[keyof StoreSettings] = coerced;
		if (field === "publicSiteUrl") {
			const trimmed = typeof coerced === "string" ? coerced.trim() : "";
			if (trimmed.length > 0) {
				try {
					const url = new URL(trimmed);
					if (url.protocol !== "http:" && url.protocol !== "https:") {
						return badRequest("Storefront URL must start with http:// or https://.");
					}
				} catch {
					return badRequest("Storefront URL must be a valid URL (e.g. https://example.com).");
				}
			}
			value = trimmed.replace(/\/$/, "") as StoreSettings[keyof StoreSettings];
		}
		if (field === "lowStockThreshold") {
			const numeric = typeof coerced === "number" ? coerced : Number(coerced);
			if (!Number.isFinite(numeric) || numeric < 0 || numeric > LOW_STOCK_THRESHOLD_MAX) {
				return badRequest("Low-stock threshold must be between 0 and 1000.");
			}
			value = Math.floor(numeric) as StoreSettings[keyof StoreSettings];
		}
		if (field === "courierFlatFeeRupees") {
			const numeric = typeof coerced === "number" ? coerced : Number(coerced);
			if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100_000) {
				return badRequest("Courier flat fee must be between 0 and 100,000.");
			}
			value = Math.floor(numeric) as StoreSettings[keyof StoreSettings];
		}
		if (field === "metaPixelId") {
			const trimmed = typeof coerced === "string" ? coerced.trim() : "";
			if (trimmed.length > 0 && !META_PIXEL_REGEX.test(trimmed)) {
				return badRequest("Meta Pixel ID must be 6–20 digits (no letters or dashes).");
			}
			value = trimmed as StoreSettings[keyof StoreSettings];
		}
		if (field === "googleAnalyticsId") {
			const trimmed = typeof coerced === "string" ? coerced.trim().toUpperCase() : "";
			if (trimmed.length > 0 && !GA_REGEX.test(trimmed)) {
				return badRequest('Google Analytics ID must look like "G-XXXXXXXXXX".');
			}
			value = trimmed as StoreSettings[keyof StoreSettings];
		}
		if (field === "googleTagManagerId") {
			const trimmed = typeof coerced === "string" ? coerced.trim().toUpperCase() : "";
			if (trimmed.length > 0 && !GTM_REGEX.test(trimmed)) {
				return badRequest('Google Tag Manager ID must look like "GTM-XXXXXX".');
			}
			value = trimmed as StoreSettings[keyof StoreSettings];
		}
		if (field === "tiktokPixelId") {
			const trimmed = typeof coerced === "string" ? coerced.trim().toUpperCase() : "";
			if (trimmed.length > 0 && !TIKTOK_PIXEL_REGEX.test(trimmed)) {
				return badRequest("TikTok Pixel ID must be 16–40 alphanumeric characters.");
			}
			value = trimmed as StoreSettings[keyof StoreSettings];
		}
		if (field === "whatsappNumber") {
			const digits = normalizeWhatsappNumber(typeof coerced === "string" ? coerced : "");
			if (digits.length > 0 && !isValidWhatsappNumber(digits)) {
				return badRequest("WhatsApp number must be 10–15 digits (country code first, no plus or spaces).");
			}
			value = digits as StoreSettings[keyof StoreSettings];
		}
		if (field === "returnPolicyHtml" || field === "privacyPolicyHtml") {
			const trimmed = typeof coerced === "string" ? coerced.trim() : "";
			if (trimmed.length > POLICY_HTML_MAX_LENGTH) {
				return badRequest(`Policy HTML must be at most ${POLICY_HTML_MAX_LENGTH.toLocaleString("en-PK")} characters.`);
			}
			value = trimmed as StoreSettings[keyof StoreSettings];
		}
		updates.push({ field, value });
	}

	if (updates.length === 0) {
		return badRequest("No recognised settings fields supplied.");
	}

	await connectDB();
	try {
		await Promise.all(
			updates.map(({ field, value }) =>
				Setting.findOneAndUpdate(
					{ key: toStoreSettingKey(field) },
					{
						$set: {
							key: toStoreSettingKey(field),
							value,
							group: groupForField(field),
							updatedBy: actor.id,
						},
					},
					{ upsert: true, runValidators: true, setDefaultsOnInsert: true },
				),
			),
		);

		invalidateStoreSettingsCache();
		// Store settings drive the storefront chrome (site name, header
		// copy, social links, contact info) and the admin chrome's brand
		// strip. Bust both caches so the next page render reads the new
		// values instead of stale ones.
		bustAdminCaches();

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "settings",
			resourceId: "store",
			resourceLabel: "Store settings",
			detail: updates.map(({ field }) => field).join(", "),
		});

		const settings = await getStoreSettings();
		return ok({ settings });
	} catch (error) {
		return handleMongoError(error);
	}
}
