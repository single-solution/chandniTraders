/**
 * Public crawl policy for the storefront.
 *
 * The disallow list comes from the admin-managed `seo.robotsDisallow`
 * Setting. Falls back to safe code defaults if the Setting is missing or invalid.
 *
 * `/api/` is always disallowed regardless of admin config — there's no
 * legitimate reason to expose route handlers to crawlers.
 */
import type { MetadataRoute } from "next";

import { connectDB, Setting } from "@store/db";

import { getStorefrontBaseUrl } from "@/lib/core/baseUrl";

const HARD_DISALLOW = ["/api/"];
const FALLBACK_DISALLOW = ["/admin", "/account", "/cart", "/checkout"];

export const revalidate = 3600;

interface RawSettingDoc {
	key: string;
	value: unknown;
}

async function loadDisallowList(): Promise<string[]> {
	try {
		await connectDB();
		const doc = await Setting.findOne({ key: "seo.robotsDisallow" }).select({ value: 1 }).lean<RawSettingDoc | null>();
		if (!doc?.value || !Array.isArray(doc.value)) return FALLBACK_DISALLOW;
		return doc.value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
	} catch {
		return FALLBACK_DISALLOW;
	}
}

export default async function robots(): Promise<MetadataRoute.Robots> {
	const base = await getStorefrontBaseUrl();
	const adminDisallow = await loadDisallowList();
	const disallow = Array.from(new Set([...adminDisallow, ...HARD_DISALLOW]));
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow,
			},
		],
		sitemap: `${base}/sitemap.xml`,
	};
}
