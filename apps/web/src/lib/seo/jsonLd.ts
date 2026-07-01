/**
 * Schema.org JSON-LD generators. Used by every public storefront page
 * to publish structured data Google + Bing pick up for rich snippets.
 *
 * Each helper returns a plain JS object; callers stringify and emit
 * inside a `<script type="application/ld+json">` block at the top of
 * the page component (so it lands in the static HTML, not after
 * hydration).
 */

import type { Product, Variant } from "@store/shared";
import { isVariantInStock } from "@store/shared";

import { categoryHref, productAbsoluteUrl } from "@/lib/catalog/productPaths";
import { getDefaultVariant } from "@/lib/productSummary";

interface SeoSettings {
	siteName: string;
	siteTagline: string;
	/** Absolute storefront origin (e.g. `https://chandnitraders.pk`). */
	siteUrl: string;
}

interface CategoryRef {
	slug: string;
	label: string;
}

interface BrandRef {
	slug: string;
	name: string;
}

/* --------------------------------------------------------------------------
 * Product JSON-LD
 * ------------------------------------------------------------------------ */

export function productJsonLd({
	product,
	variant,
	brand,
	category,
	settings,
}: {
	product: Product;
	variant: Variant;
	brand: BrandRef | null;
	category: CategoryRef | null;
	settings: SeoSettings;
}): Record<string, unknown> {
	const url = productAbsoluteUrl(settings.siteUrl, product, { variant });
	const heroImage = variant.images?.[0];
	const images = (variant.images ?? []).map((image) => image?.variants?.detail || image?.variants?.full).filter((url): url is string => typeof url === "string");

	const offer: Record<string, unknown> = {
		"@type": "Offer",
		url,
		priceCurrency: "PKR",
		price: variant.priceRupees,
		availability: isVariantInStock(variant) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
	};
	if (brand?.name) {
		offer.seller = {
			"@type": "Organization",
			name: settings.siteName,
		};
	}

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Product",
		name: `${brand?.name ?? product.brandName} ${product.name}`.trim(),
		sku: variant.id,
		url,
		image: images.length > 0 ? images : heroImage ? [heroImage.variants.detail] : undefined,
		description: `${brand?.name ?? product.brandName} ${product.name} — available at ${settings.siteName}.`,
		brand: brand?.name ? { "@type": "Brand", name: brand.name } : undefined,
		category: category?.label,
		offers: offer,
	};

	return jsonLd;
}

/* --------------------------------------------------------------------------
 * BreadcrumbList JSON-LD
 * ------------------------------------------------------------------------ */

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: crumbs.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: crumb.url,
		})),
	};
}

/* --------------------------------------------------------------------------
 * CollectionPage JSON-LD (category landings)
 * ------------------------------------------------------------------------ */

export function collectionPageJsonLd({ category, products, settings }: { category: CategoryRef; products: Product[]; settings: SeoSettings }): Record<string, unknown> {
	const url = `${settings.siteUrl}${categoryHref(category.slug)}`;
	const items = products.slice(0, 24).map((product, index) => ({
		"@type": "ListItem",
		position: index + 1,
		url: productAbsoluteUrl(settings.siteUrl, product, {
			variant: getDefaultVariant(product),
		}),
		name: `${product.brandName} ${product.name}`,
	}));

	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: `${category.label} — ${settings.siteName}`,
		url,
		mainEntity: {
			"@type": "ItemList",
			itemListElement: items,
		},
	};
}

/* --------------------------------------------------------------------------
 * Organization + WebSite JSON-LD (home)
 * ------------------------------------------------------------------------ */

export function organizationJsonLd(
	settings: SeoSettings & {
		contactPhone?: string;
		contactEmail?: string;
		logoUrl?: string;
		sameAs?: string[];
		address?: {
			street?: string;
			city?: string;
			region?: string;
			postalCode?: string;
			country?: string;
		};
	},
): Record<string, unknown> {
	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: settings.siteName,
		url: settings.siteUrl,
		description: settings.siteTagline,
	};
	if (settings.logoUrl) {
		jsonLd.logo = settings.logoUrl;
	}
	if (settings.sameAs && settings.sameAs.length > 0) {
		jsonLd.sameAs = settings.sameAs;
	}
	if (settings.address?.street?.trim()) {
		jsonLd.address = {
			"@type": "PostalAddress",
			streetAddress: settings.address.street,
			addressLocality: settings.address.city,
			addressRegion: settings.address.region,
			postalCode: settings.address.postalCode,
			addressCountry: settings.address.country,
		};
	}
	if (settings.contactPhone || settings.contactEmail) {
		jsonLd.contactPoint = [
			{
				"@type": "ContactPoint",
				contactType: "customer service",
				telephone: settings.contactPhone,
				email: settings.contactEmail,
			},
		];
	}
	return jsonLd;
}

export function websiteJsonLd(settings: SeoSettings): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: settings.siteName,
		url: settings.siteUrl,
		potentialAction: {
			"@type": "SearchAction",
			target: `${settings.siteUrl}/?q={search_term_string}`,
			"query-input": "required name=search_term_string",
		},
	};
}

/* --------------------------------------------------------------------------
 * Convenience: pre-stringified <script> payload
 * ------------------------------------------------------------------------ */

export function jsonLdScriptContent(obj: Record<string, unknown>): string {
	return JSON.stringify(obj, (_key, value) => (value === undefined ? undefined : value)).replace(/</g, "\\u003c");
}
