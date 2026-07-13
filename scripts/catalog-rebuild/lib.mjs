/**
 * Pure catalog-mapping helpers shared by the plan and apply stages.
 *
 * These mirror the logic in `packages/shared/src/catalogBrands.ts` and the
 * former seed scripts, re-expressed in plain JS so the pipeline can run under
 * `node` without a TypeScript loader. Keep them in sync with the source of
 * truth if brand/category rules change.
 */

export function slugify(text, maxLength = 64) {
	return String(text)
		.toLowerCase()
		.trim()
		.replace(/&/g, " ")
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength);
}

const SK_LINE = /\b(?:sk|s\.k\.?|iturbo|grace|magnum|iris|sober|nova|imperial|regency|deluxe|passion|room\s+cooler\s+sk)\b/i;
const ROYAL_LINE = /\b(?:royal|super|metal|plastic|classic|energy|executive|excutive|antique|butterfly|caroma|mystic|louver|window|eco|power\s*max|tcp|false\s*ceiling|ultra|mega|circomatic|diamond|sapphire|ovate)\b/i;
const TAIMOOR_LINE = /\b(?:taimoor|tamoor|penta)\b/i;

const BRAND_NAMES = { royal: "Royal", sk: "SK", taimoor: "Taimoor" };

export function resolveBrand(productName, wooBrands) {
	if (Array.isArray(wooBrands) && wooBrands.length > 0) {
		const slug = String(wooBrands[0].slug || "").trim().toLowerCase();
		if (BRAND_NAMES[slug]) return { slug, name: BRAND_NAMES[slug] };
	}
	const name = productName.replace(/\s+/g, " ").trim();
	if (TAIMOOR_LINE.test(name)) return { slug: "taimoor", name: "Taimoor" };
	if (SK_LINE.test(name)) return { slug: "sk", name: "SK" };
	return { slug: "royal", name: "Royal" };
}

const WOO_CATEGORY_MAP = {
	"bracket-fans": "bracket-fans",
	"ceiling-fans": "ceiling-fans",
	"220v-fans": "ceiling-fans",
	"30w-fans": "ceiling-fans",
	"ac-dc-fans": "ceiling-fans",
	"inverter-fans": "ceiling-fans",
	fans: "ceiling-fans",
	"exhaust-fans": "exhaust-fans",
	"pedestal-fans": "pedestal-fans",
	uncategorized: null,
};

export function mapCategory(categories, name) {
	const slugs = (categories || []).map((row) => row.slug).filter(Boolean);
	for (const slug of slugs) {
		if (slug.includes("cooler")) return "room-coolers";
		const mapped = WOO_CATEGORY_MAP[slug];
		if (mapped) return mapped;
	}
	if (/cooler/i.test(name)) return "room-coolers";
	if (/pedestal|stand fan/i.test(name)) return "pedestal-fans";
	if (/exhaust|window/i.test(name)) return "exhaust-fans";
	if (/bracket|wall fan|louver/i.test(name)) return "bracket-fans";
	return "ceiling-fans";
}

/** Derive stable, name-based attributes (everything except color). */
export function deriveAttributes(name, categorySlug) {
	const attributes = {};
	const lower = name.toLowerCase();

	const sizeMatch = lower.match(/\b(56|48|36|30|24|21|20|18|14|12|10|8)\b/);
	if (sizeMatch && !["room-coolers"].includes(categorySlug)) {
		attributes["sweep-size"] = sizeMatch[1];
	}

	if (lower.includes("ac/dc") || lower.includes("ac-dc") || lower.includes("dual power")) attributes["motor-type"] = "ac-dc";
	else if (lower.includes("inverter") || lower.includes("bldc") || lower.includes("dc ")) attributes["motor-type"] = "inverter";
	else if (["ceiling-fans", "bracket-fans", "pedestal-fans"].includes(categorySlug)) attributes["motor-type"] = "ac";

	if (lower.includes("copper") || ["ceiling-fans", "bracket-fans", "exhaust-fans", "pedestal-fans"].includes(categorySlug)) {
		attributes["winding"] = "copper";
	}

	if (categorySlug === "exhaust-fans") {
		if (lower.includes("plastic")) attributes["body-type"] = "plastic";
		else if (lower.includes("metal")) attributes["body-type"] = "metal";
	}
	return attributes;
}

export function parsePrice(value) {
	const amount = Number.parseFloat(String(value ?? "0"));
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return Math.round(amount);
}

export function inStock(stockStatus) {
	const status = String(stockStatus ?? "").toLowerCase();
	return status === "instock" || status === "onbackorder" || status === "";
}
