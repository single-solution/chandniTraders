"use client";

import { useEffect, useState } from "react";

import type { SeoSettings, StoredImage } from "@store/shared";
import { isStoredImage } from "@store/shared";

import { apiFetch } from "@/lib/api";
import { resolvePublicSiteUrl } from "@store/shared";
import { useStoreSettings } from "@/lib/storeSettingsContext";

interface AdminSettingRow {
	key: string;
	value: unknown;
}

interface SettingsListResponse {
	items: AdminSettingRow[];
}

const DEFAULT_TEMPLATE = "{title} | {storeName}";

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function ogUrlFromStoredImage(value: unknown): string {
	if (!isStoredImage(value)) return "";
	return value.variants.detail || value.variants.card || "";
}

export function useSeoSettings(): {
	settings: SeoSettings | null;
	loading: boolean;
} {
	const store = useStoreSettings();
	const [seoOverrides, setSeoOverrides] = useState<{
		seoStoreName: string;
		titleTemplate: string;
		defaultDescription: string;
		defaultOgImageUrl: string;
	} | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const response = await apiFetch<SettingsListResponse>("/api/settings?group=seo");
				if (cancelled) return;
				const map = new Map(response.items.map((row) => [row.key, row.value]));
				const ogDefault = map.get("seo.ogImageDefault");
				setSeoOverrides({
					seoStoreName: asString(map.get("seo.storeName")),
					titleTemplate: asString(map.get("seo.titleTemplate"), DEFAULT_TEMPLATE),
					defaultDescription: asString(map.get("seo.defaultDescription"), store.siteTagline),
					defaultOgImageUrl: ogUrlFromStoredImage(ogDefault),
				});
			} catch {
				if (!cancelled) {
					setSeoOverrides({
						seoStoreName: "",
						titleTemplate: DEFAULT_TEMPLATE,
						defaultDescription: store.siteTagline,
						defaultOgImageUrl: "",
					});
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [store.siteTagline]);

	if (loading || !seoOverrides) {
		return { settings: null, loading: true };
	}

	const settings: SeoSettings = {
		siteName: store.siteName,
		siteTagline: store.siteTagline,
		siteUrl: resolvePublicSiteUrl(store.publicSiteUrl),
		...seoOverrides,
	};

	return { settings, loading: false };
}

export function storedImageFromSetting(value: unknown): StoredImage | null {
	return isStoredImage(value) ? value : null;
}
