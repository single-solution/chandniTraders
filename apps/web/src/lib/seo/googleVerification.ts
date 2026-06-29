/**
 * Lightweight reader for the `seo.googleSiteVerification` Setting. The
 * value is emitted in the root layout as a `<meta name="google-site-
 * verification" ...>` tag (via Next.js `metadata.verification.google`),
 * so Google can verify domain ownership without an HTML upload.
 *
 * Kept separate from `seoSettings.ts` so the layout (which runs on every
 * request) can pull the verification token without forcing a fetch of
 * the larger SEO settings blob until a route actually needs it.
 */

import { unstable_cache } from "next/cache";

import { connectDB, Setting } from "@store/db";
import { logger } from "@store/shared";

import { STOREFRONT_CACHE_TAG } from "@/lib/core/cached";

interface RawSettingDoc {
	key: string;
	value: unknown;
}

const TTL_SECONDS = 60;

const loadVerification = unstable_cache(
	async (): Promise<string> => {
		try {
			await connectDB();
			const doc = await Setting.findOne({ key: "seo.googleSiteVerification" }).select({ value: 1 }).lean<RawSettingDoc | null>();
			return typeof doc?.value === "string" ? doc.value : "";
		} catch (error) {
			logger.error({ error }, "seo-google-verification: load failed, skipping tag");
			return "";
		}
	},
	["seo-google-verification"],
	{ revalidate: TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export async function getGoogleSiteVerification(): Promise<string | null> {
	const value = await loadVerification();
	return value.trim().length > 0 ? value.trim() : null;
}
