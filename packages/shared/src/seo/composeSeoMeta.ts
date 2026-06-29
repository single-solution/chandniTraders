/**
 * Pure `(entity, settings) → ResolvedSeoMeta` composition.
 * Shared by storefront render and admin SERP preview.
 */

import type { Brand, Offer, Product, Variant } from "../types";
import { buildRobotsDirective, type SeoMeta } from "./seoMeta";
import { applyTitleTemplate } from "./titleTemplate";

export interface ResolvedSeoMeta {
	title: string;
	description: string;
	canonical: string;
	ogImageUrl: string;
	twitterCard: "summary" | "summary_large_image";
	robots: string;
}

export interface SeoSettings {
	siteName: string;
	siteTagline: string;
	siteUrl: string;
	seoStoreName: string;
	titleTemplate: string;
	defaultDescription: string;
	defaultOgImageUrl: string;
}

export interface CategorySeoRef {
	slug: string;
	label: string;
	description?: string;
}

export interface BrandSeoRef {
	slug: string;
	name: string;
}

const DESCRIPTION_MAX = 160;

function truncateDescription(input: string): string {
	if (input.length <= DESCRIPTION_MAX) return input;
	const slice = input.slice(0, DESCRIPTION_MAX);
	const lastSpace = slice.lastIndexOf(" ");
	return lastSpace > 80 ? slice.slice(0, lastSpace).trimEnd() + "…" : slice + "…";
}

function absoluteUrl(siteUrl: string, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	return `${siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveStoreName(settings: SeoSettings): string {
	return settings.seoStoreName.trim() || settings.siteName;
}

function resolveTitle(override: string | undefined, baseTitle: string, settings: SeoSettings, extraVars: Record<string, string> = {}): string {
	if (override && override.trim().length > 0) {
		return override.trim();
	}
	return applyTitleTemplate(settings.titleTemplate, {
		title: baseTitle,
		storeName: resolveStoreName(settings),
		...extraVars,
	});
}

function resolveDescription(override: string | undefined, derived: string, fallback: string): string {
	const raw = override?.trim() || (derived.trim().length > 0 ? derived.trim() : fallback.trim());
	return truncateDescription(raw);
}

function resolveCanonical(override: string | undefined, path: string, siteUrl: string): string {
	if (override && override.trim().length > 0) {
		return absoluteUrl(siteUrl, override.trim());
	}
	return absoluteUrl(siteUrl, path);
}

function resolveOgImage(override: string | undefined, derived: string | undefined, fallback: string, siteUrl: string): string {
	const raw = override?.trim() || derived?.trim() || fallback.trim();
	if (!raw) return "";
	return absoluteUrl(siteUrl, raw);
}

export function composeProductSeo({
	product,
	variant,
	brand,
	category,
	settings,
	seo,
}: {
	product: Product;
	variant: Variant;
	brand: BrandSeoRef | null;
	category: CategorySeoRef | null;
	settings: SeoSettings;
	seo?: SeoMeta;
}): ResolvedSeoMeta {
	const brandName = brand?.name ?? product.brandName;
	const baseTitle = `${brandName} ${product.name}`.trim();
	const path = `/${product.categorySlug}/${product.slug}`;
	const heroImage = product.images[0]?.variants?.detail ?? "";
	const derivedDescription = category
		? `${baseTitle} — ${category.label.toLowerCase()} from ${resolveStoreName(settings)}.`
		: `${baseTitle} from ${resolveStoreName(settings)}.`;

	return {
		title: resolveTitle(seo?.title, baseTitle, settings, {
			brandName,
			categoryLabel: category?.label ?? "",
		}),
		description: resolveDescription(seo?.description, derivedDescription, settings.defaultDescription),
		canonical: resolveCanonical(seo?.canonicalUrl, path, settings.siteUrl),
		ogImageUrl: resolveOgImage(seo?.ogImageUrl, heroImage, settings.defaultOgImageUrl, settings.siteUrl),
		twitterCard: heroImage || settings.defaultOgImageUrl ? "summary_large_image" : "summary",
		robots: buildRobotsDirective(seo),
	};
}

export function composeCategorySeo({ category, settings, seo }: { category: CategorySeoRef; settings: SeoSettings; seo?: SeoMeta }): ResolvedSeoMeta {
	const baseTitle = `Shop ${category.label}`;
	const path = `/${category.slug}`;
	const derivedDescription = category.description?.trim() || `Browse ${category.label.toLowerCase()} at ${resolveStoreName(settings)}.`;

	return {
		title: resolveTitle(seo?.title, baseTitle, settings, {
			categoryLabel: category.label,
		}),
		description: resolveDescription(seo?.description, derivedDescription, settings.defaultDescription),
		canonical: resolveCanonical(seo?.canonicalUrl, path, settings.siteUrl),
		ogImageUrl: resolveOgImage(seo?.ogImageUrl, undefined, settings.defaultOgImageUrl, settings.siteUrl),
		twitterCard: seo?.ogImageUrl || settings.defaultOgImageUrl ? "summary_large_image" : "summary",
		robots: buildRobotsDirective(seo),
	};
}

export function composeBrandSeo({ brand, settings, seo }: { brand: Brand; settings: SeoSettings; seo?: SeoMeta }): ResolvedSeoMeta {
	const baseTitle = brand.name;
	const path = `/?brand=${brand.slug}`;
	const derivedDescription = `${brand.name} products at ${resolveStoreName(settings)}.`;

	return {
		title: resolveTitle(seo?.title, baseTitle, settings, {
			brandName: brand.name,
		}),
		description: resolveDescription(seo?.description, derivedDescription, settings.defaultDescription),
		canonical: resolveCanonical(seo?.canonicalUrl, path, settings.siteUrl),
		ogImageUrl: resolveOgImage(seo?.ogImageUrl, undefined, settings.defaultOgImageUrl, settings.siteUrl),
		twitterCard: settings.defaultOgImageUrl ? "summary_large_image" : "summary",
		robots: buildRobotsDirective(seo),
	};
}

export function composeOfferSeo({ offer, settings, seo }: { offer: Offer; settings: SeoSettings; seo?: SeoMeta }): ResolvedSeoMeta {
	const baseTitle = offer.title;
	const path = `/deals#${offer.slug}`;
	const derivedDescription = offer.description;
	const bannerUrl = offer.bannerImage?.variants?.detail;

	return {
		title: resolveTitle(seo?.title, baseTitle, settings),
		description: resolveDescription(seo?.description, derivedDescription, settings.defaultDescription),
		canonical: resolveCanonical(seo?.canonicalUrl, path, settings.siteUrl),
		ogImageUrl: resolveOgImage(seo?.ogImageUrl, bannerUrl, settings.defaultOgImageUrl, settings.siteUrl),
		twitterCard: seo?.ogImageUrl || bannerUrl || settings.defaultOgImageUrl ? "summary_large_image" : "summary",
		robots: buildRobotsDirective(seo),
	};
}

export function composeHomeSeo({ settings, seo }: { settings: SeoSettings; seo?: SeoMeta }): ResolvedSeoMeta {
	const baseTitle = resolveStoreName(settings);
	const derivedDescription = settings.siteTagline;
	return {
		title: resolveTitle(seo?.title, baseTitle, settings),
		description: resolveDescription(seo?.description, derivedDescription, settings.defaultDescription),
		canonical: resolveCanonical(seo?.canonicalUrl, "/", settings.siteUrl),
		ogImageUrl: resolveOgImage(seo?.ogImageUrl, undefined, settings.defaultOgImageUrl, settings.siteUrl),
		twitterCard: settings.defaultOgImageUrl ? "summary_large_image" : "summary",
		robots: buildRobotsDirective(seo),
	};
}
