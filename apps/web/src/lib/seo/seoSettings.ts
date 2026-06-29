/**
 * Resolve the global SEO settings the storefront cares about. The values
 * live in the `Setting` collection and are merged here with the runtime fallbacks used by
 * `composeSeoMeta`.
 *
 * This helper is deliberately separate from `StoreSettings`:
 *   - `StoreSettings` carries the strongly-typed branding/contact/policy
 *     bundle baked into the bundle.
 *   - SEO has loose, optional, admin-only values (templates, defaults,
 *     org block) that we don't want to leak into every storefront
 *     component prop tree.
 *
 * Reads go through `unstable_cache` keyed on a constant so a 30s window
 * collapses the per-request Mongo round-trip; admin SEO saves bust the
 * `STOREFRONT_CACHE_TAG` to surface immediately.
 */

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { connectDB, getStoreSettings, Setting } from "@store/db";
import { logger, resolvePublicSiteUrl, type StoredImage, type StoreSettings } from "@store/shared";

import { STOREFRONT_CACHE_TAG } from "@/lib/core/cached";
import type { SeoSettings } from "./composeSeoMeta";

const SEO_KEY_PREFIXES = ["seo.", "store.logo", "store.favicon"] as const;

interface RawSettingDoc {
	key: string;
	value: unknown;
}

function asString(value: unknown, fallback = ""): string {
	if (typeof value === "string") return value;
	return fallback;
}

function isStoredImage(value: unknown): value is StoredImage {
	if (!value || typeof value !== "object") return false;
	const imageValue = value as Record<string, unknown>;
	return (
		typeof imageValue.blurDataURL === "string" &&
		typeof imageValue.alt === "string" &&
		!!imageValue.variants &&
		typeof (imageValue.variants as Record<string, unknown>).detail === "string"
	);
}

function seoSettingsFromStore(store: StoreSettings, map: Map<string, unknown>): SeoSettings {
	const ogImageDefault = map.get("seo.ogImageDefault");
	const storeLogo = map.get("store.logo");
	const fallbackOgUrl =
		(store.brandLogoLight.trim() || store.brandLogoDark.trim() || "") ||
		(isStoredImage(ogImageDefault) ? ogImageDefault.variants.detail : isStoredImage(storeLogo) ? storeLogo.variants.detail : "") ||
		"";

	return {
		siteName: store.siteName,
		siteTagline: store.siteTagline,
		siteUrl: resolvePublicSiteUrl(store.publicSiteUrl),
		seoStoreName: asString(map.get("seo.storeName"), ""),
		titleTemplate: asString(map.get("seo.titleTemplate"), "{title} | {storeName}"),
		defaultDescription: asString(map.get("seo.defaultDescription"), store.siteTagline),
		defaultOgImageUrl: fallbackOgUrl,
	};
}

async function seoSettingsFallback(): Promise<SeoSettings> {
	const store = await getStoreSettings();
	return seoSettingsFromStore(store, new Map());
}

const TIMEZONE_INVARIANT_TTL_SECONDS = 30;

const loadSeoSettings = unstable_cache(
	async (): Promise<SeoSettings> => {
		try {
			await connectDB();
			const [store, docs] = await Promise.all([
				getStoreSettings(),
				Setting.find({
					key: {
						$in: ["seo.storeName", "seo.titleTemplate", "seo.defaultDescription", "seo.ogImageDefault", "store.logo"],
					},
				})
					.select({ key: 1, value: 1 })
					.lean<RawSettingDoc[]>(),
			]);
			const map = new Map(docs.map((doc) => [doc.key, doc.value]));
			return seoSettingsFromStore(store, map);
		} catch (error) {
			logger.error({ error }, "seo-settings: load failed, using store fallbacks");
			return seoSettingsFallback();
		}
	},
	["seo-settings"],
	{ revalidate: TIMEZONE_INVARIANT_TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export const getSeoSettings = cache(() => loadSeoSettings());

// The set of Setting keys this helper reads — exported so admin write
// paths can include them in cache-bust decisions.
export const SEO_SETTING_KEY_PREFIXES = SEO_KEY_PREFIXES;
