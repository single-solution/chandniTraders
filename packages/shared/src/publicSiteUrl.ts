const LOCAL_FALLBACK = "http://localhost:3000";

/**
 * Canonical public storefront origin.
 *
 * Resolution order (first non-empty wins):
 *   1. `override` — admin-managed `StoreSettings.publicSiteUrl`
 *   2. Deploy env vars — safety net until the admin saves a value
 *   3. `localhost:3000` — last-resort dev fallback
 */
export function resolvePublicSiteUrl(override?: string | null): string {
	const candidates = [
		override,
		process.env.STOREFRONT_BASE_URL,
		process.env.NEXT_PUBLIC_STOREFRONT_URL,
		process.env.NEXT_PUBLIC_SITE_URL,
		process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
		process.env.AUTH_URL,
	];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate.trim().replace(/\/$/, "");
		}
	}
	return LOCAL_FALLBACK;
}

/** Alias kept for admin SEO helpers that predate the shared export. */
