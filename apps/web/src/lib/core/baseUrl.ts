import { resolvePublicSiteUrl } from "@store/shared";

import { getStoreSettingsCached } from "@/lib/core/cached";

/**
 * Env-only storefront origin — use when store settings are unavailable
 * (build-time fallbacks). Prefer {@link getStorefrontBaseUrl} at runtime.
 */
export function getBaseUrl(): string {
	return resolvePublicSiteUrl();
}

/** Storefront origin with admin `publicSiteUrl` override when set. */
export async function getStorefrontBaseUrl(): Promise<string> {
	const store = await getStoreSettingsCached();
	return resolvePublicSiteUrl(store.publicSiteUrl);
}
