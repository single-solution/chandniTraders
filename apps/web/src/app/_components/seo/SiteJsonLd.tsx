import { connectDB, getStoreSettings, Setting } from "@store/db";
import { resolvePublicSiteUrl, type StoredImage } from "@store/shared";

import { organizationJsonLd, websiteJsonLd, jsonLdScriptContent } from "@/lib/seo/jsonLd";

interface OrganizationAddressRow {
	street: string;
	city: string;
	region: string;
	postalCode: string;
	country: string;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function isStoredImage(value: unknown): value is StoredImage {
	if (!value || typeof value !== "object") {
		return false;
	}
	const imageValue = value as Record<string, unknown>;
	return typeof imageValue.blurDataURL === "string" && !!imageValue.variants && typeof (imageValue.variants as Record<string, unknown>).detail === "string";
}

function storedImageDetail(value: unknown): string {
	return isStoredImage(value) ? value.variants.detail : "";
}

function parseOrganizationAddress(value: unknown): OrganizationAddressRow | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const row = value as Record<string, unknown>;
	const street = asString(row.street).trim();
	if (!street) {
		return null;
	}
	return {
		street,
		city: asString(row.city).trim(),
		region: asString(row.region).trim(),
		postalCode: asString(row.postalCode).trim(),
		country: asString(row.country, "PK").trim() || "PK",
	};
}

function parseSameAs(value: unknown, fallback: string[]): string[] {
	if (Array.isArray(value)) {
		const fromDb = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
		if (fromDb.length > 0) {
			return fromDb;
		}
	}
	return fallback;
}

async function loadSiteJsonLdPayload() {
	await connectDB();
	const [store, docs] = await Promise.all([
		getStoreSettings(),
		Setting.find({
			key: {
				$in: [
					"seo.organization.legalName",
					"seo.organization.contactPhone",
					"seo.organization.contactEmail",
					"seo.organization.address",
					"seo.organization.sameAs",
					"seo.ogImageDefault",
					"store.logo",
				],
			},
		})
			.select({ key: 1, value: 1 })
			.lean<Array<{ key: string; value: unknown }>>(),
	]);

	const map = new Map(docs.map((doc) => [doc.key, doc.value]));
	const siteUrl = resolvePublicSiteUrl(store.publicSiteUrl);
	const socialFallback = [store.socialFacebook, store.socialInstagram, store.socialTiktok, store.socialYoutube, store.socialGoogleMaps].filter(
		(url) => url.trim().length > 0,
	);

	const logoUrl =
		store.brandLogoLight.trim() ||
		store.brandLogoDark.trim() ||
		storedImageDetail(map.get("seo.ogImageDefault")) ||
		storedImageDetail(map.get("store.logo")) ||
		undefined;

	return {
		siteName: asString(map.get("seo.organization.legalName"), store.siteName),
		siteTagline: store.siteTagline,
		siteUrl,
		contactPhone: asString(map.get("seo.organization.contactPhone"), store.supportPhone),
		contactEmail: asString(map.get("seo.organization.contactEmail"), store.supportEmail),
		logoUrl: logoUrl || undefined,
		sameAs: parseSameAs(map.get("seo.organization.sameAs"), socialFallback),
		address: parseOrganizationAddress(map.get("seo.organization.address")) ?? undefined,
	};
}

/** Global Organization + WebSite JSON-LD on every storefront page. */
export async function SiteJsonLd() {
	const payload = await loadSiteJsonLdPayload();
	const organization = organizationJsonLd(payload);
	const website = websiteJsonLd(payload);

	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(organization) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(website) }} />
		</>
	);
}
