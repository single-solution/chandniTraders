import type { ResolvedSeoMeta } from "./composeSeoMeta";

export type SeoChecklistStatus = "pass" | "warn" | "fail" | "na";

export interface SeoChecklistItem {
	id: string;
	label: string;
	status: SeoChecklistStatus;
}

export interface SeoChecklistResult {
	items: SeoChecklistItem[];
	score: number;
}

export type CatalogSeoKind = "product" | "category" | "brand" | "offer";

export interface CatalogSeoChecklistContext {
	slug: string;
	hasHeroImage?: boolean;
	allVariantImagesHaveAlt?: boolean;
}

function lengthStatus(len: number, passMin: number, passMax: number, warnMin: number, warnMax: number): SeoChecklistStatus {
	if (len >= passMin && len <= passMax) return "pass";
	if (len >= warnMin && len <= warnMax) return "warn";
	return "fail";
}

function keywordIn(text: string, keyword: string): boolean {
	return text.toLowerCase().includes(keyword.toLowerCase());
}

export function evaluateSeoChecklist(
	resolved: ResolvedSeoMeta,
	entity: CatalogSeoChecklistContext,
	focusKeyword: string | undefined,
	entityType: CatalogSeoKind,
): SeoChecklistResult {
	const keyword = focusKeyword?.trim() ?? "";
	const titleLen = resolved.title.length;
	const descLen = resolved.description.length;

	const items: SeoChecklistItem[] = [
		{
			id: "title-length",
			label: "Title length (30–60 chars ideal)",
			status: lengthStatus(titleLen, 30, 60, 20, 79),
		},
		{
			id: "description-length",
			label: "Description length (120–160 chars ideal)",
			status: lengthStatus(descLen, 120, 160, 80, 200),
		},
		{
			id: "keyword-title",
			label: "Focus keyword in title",
			status: keyword ? (keywordIn(resolved.title, keyword) ? "pass" : "fail") : "na",
		},
		{
			id: "keyword-description",
			label: "Focus keyword in description",
			status: keyword ? (keywordIn(resolved.description, keyword) ? "pass" : "fail") : "na",
		},
		{
			id: "keyword-slug",
			label: "Focus keyword in URL slug",
			status: keyword ? (keywordIn(entity.slug, keyword) ? "pass" : "fail") : "na",
		},
	];

	if (entityType === "product" || entityType === "category") {
		items.push({
			id: "hero-image",
			label: "Hero / icon image present",
			status: entity.hasHeroImage ? "pass" : "fail",
		});
	}

	if (entityType === "product") {
		items.push({
			id: "variant-alt",
			label: "All variant images have alt text",
			status: entity.allVariantImagesHaveAlt === undefined ? "na" : entity.allVariantImagesHaveAlt ? "pass" : "fail",
		});
	}

	items.push({
		id: "json-ld",
		label: "Structured data can be generated",
		status: "pass",
	});

	const scored = items.filter((item) => item.status !== "na");
	const passCount = scored.filter((item) => item.status === "pass").length;
	const warnCount = scored.filter((item) => item.status === "warn").length;
	const score = scored.length === 0 ? 0 : Math.round(((passCount + warnCount * 0.5) / scored.length) * 100);

	return { items, score };
}

export function seoScoreTone(score: number): "success" | "warn" | "danger" {
	if (score >= 70) return "success";
	if (score >= 50) return "warn";
	return "danger";
}

export function calculateProductSeoScore(
	productName: string,
	brandName: string,
	seo: { title?: string; description?: string; canonicalUrl?: string; focusKeyword?: string } | undefined,
	hasHeroImage: boolean,
	storeName: string,
): number {
	const keyword = seo?.focusKeyword?.trim().toLowerCase() || "";
	const baseTitle = `${brandName} ${productName}`.trim();
	const title = seo?.title || `${baseTitle} | ${storeName}`;
	const description = seo?.description || `${baseTitle} from ${storeName}.`;
	const slug = seo?.canonicalUrl || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

	const titleLen = title.length;
	const descLen = description.length;

	let passCount = 0;
	let warnCount = 0;
	let totalScored = 3; // title-length, description-length, json-ld

	// 1. Title Length
	if (titleLen >= 30 && titleLen <= 60) passCount++;
	else if (titleLen >= 20 && titleLen <= 79) warnCount++;

	// 2. Description Length
	if (descLen >= 120 && descLen <= 160) passCount++;
	else if (descLen >= 80 && descLen <= 200) warnCount++;

	// 3. Hero Image
	totalScored++;
	if (hasHeroImage) passCount++;

	// 4. JSON-LD (always pass)
	passCount++;

	// Keywords
	if (keyword) {
		totalScored += 3; // title, desc, slug
		if (title.toLowerCase().includes(keyword)) passCount++;
		if (description.toLowerCase().includes(keyword)) passCount++;
		if (slug.toLowerCase().includes(keyword)) passCount++;
	}

	return totalScored === 0 ? 0 : Math.round(((passCount + warnCount * 0.5) / totalScored) * 100);
}
