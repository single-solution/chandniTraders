import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { ChevronRight } from "lucide-react";

import type { Product } from "@store/shared";
import { productConfiguratorAttributeSlugs } from "@store/shared";

import { PdpScrollReset } from "./_components/PdpScrollReset";
import { ProductChatBeacon } from "./_components/ProductChatBeacon";
import { VariantAwareGallery } from "@/components/shared/PdpGallery";
import { PdpOfferBadgeOverlay } from "@/components/shared/PdpOfferBadgeOverlay";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductCardSkeleton } from "@/components/shared/ProductCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { VariantProvider } from "@/components/shared/VariantContext";
import { VariantSelector } from "@/components/shared/VariantSelector";
import { resolveExactVariantFromSearch } from "@/lib/catalog/pdpSelection";
import { getDefaultVariant } from "@/lib/productSummary";
import { productAbsoluteUrl, productHref, categoryHref } from "@/lib/catalog/productPaths";
import { getAttributesCached, getBrandBySlugCached, getCategoryBySlugCached, getProductBySlugCached, getProductsPageCached } from "@/lib/core/cached";
import { getProductLiveCommerce, mergeProductWithLiveCommerce } from "@/lib/core/liveCommerce";
import { composeProductSeo } from "@/lib/seo/composeSeoMeta";
import { getSeoSettings } from "@/lib/seo/seoSettings";
import { breadcrumbJsonLd, jsonLdScriptContent, productJsonLd } from "@/lib/seo/jsonLd";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

/**
 * Category-agnostic product detail page at `/shop/<categorySlug>/<productSlug>`.
 */

/**
 * Partial dynamism: the static shell (gallery, breadcrumbs, name,
 * description, grade copy, related rail) is ISR-cached with admin-tag
 * busting; live per-variant pricing + stock streams in through a
 * `<Suspense>` boundary via `getProductLiveCommerce`, so the
 * shell never blocks on the freshness-critical commerce query.
 *
 * Result: `<Link>` prefetch can warm the page chrome, the click renders
 * the shell instantly, and the variant card streams in within the same
 * paint cycle.
 */
export const revalidate = 60;

interface ProductDetailPageProps {
	params: Promise<{ category: string; slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Pool size we fetch when looking for "related" items — over-fetched so we
 *  can drop the current product before slicing to the display cap. */
const RELATED_PRODUCTS_POOL = 8;
/** Final number of related items rendered next to the product detail view. */
const RELATED_PRODUCTS_DISPLAY_COUNT = 4;

function attributeSlugsForProduct(product: Product, allAttributes: Awaited<ReturnType<typeof getAttributesCached>>): string[] {
	const categoryAttributes = allAttributes.filter((row) => row.categorySlug === product.categorySlug);
	return productConfiguratorAttributeSlugs(product, categoryAttributes);
}

export async function generateMetadata({ params, searchParams }: ProductDetailPageProps): Promise<Metadata> {
	const [{ category, slug }, search] = await Promise.all([params, searchParams]);
	const product = await getProductBySlugCached(slug);
	if (!product) {
		return { title: "Not found" };
	}
	const [brand, categoryMeta, seoSettings, allAttributes] = await Promise.all([
		getBrandBySlugCached(product.brandSlug, product.categorySlug),
		getCategoryBySlugCached(category),
		getSeoSettings(),
		getAttributesCached(),
	]);
	const attributeSlugs = attributeSlugsForProduct(product, allAttributes);
	const variant = resolveExactVariantFromSearch(product, search, attributeSlugs) ?? getDefaultVariant(product);
	const heroImage = product.images?.[0];
	const resolved = composeProductSeo({
		product,
		variant,
		brand: brand ? { slug: brand.slug, name: brand.name } : null,
		category: categoryMeta ? { slug: categoryMeta.slug, label: categoryMeta.label } : null,
		settings: seoSettings,
		seo: product.seo,
	});
	const canonical = productAbsoluteUrl(seoSettings.siteUrl, product, {
		variant,
	});
	const brandName = brand?.name ?? product.brandName;
	return {
		title: resolved.title,
		description: resolved.description,
		alternates: { canonical },
		robots: resolved.robots,
		openGraph: {
			title: resolved.title,
			description: resolved.description,
			url: canonical,
			type: "website",
			images: heroImage
				? [
						{
							url: resolved.ogImageUrl || heroImage.variants.detail,
							width: heroImage.width,
							height: heroImage.height,
							alt: heroImage.alt || `${brandName} ${product.name}`,
						},
					]
				: undefined,
		},
		twitter: {
			card: resolved.twitterCard,
			title: resolved.title,
			description: resolved.description,
			images: resolved.ogImageUrl ? [resolved.ogImageUrl] : undefined,
		},
	};
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
	const [{ category, slug }, search] = await Promise.all([params, searchParams]);

	const [categoryMeta, product, allAttributes, liveVariants] = await Promise.all([
		getCategoryBySlugCached(category),
		getProductBySlugCached(slug),
		getAttributesCached(),
		getProductLiveCommerce(slug),
	]);

	if (!categoryMeta) {
		notFound();
	}

	if (!product) {
		notFound();
	}

	const storefrontProduct = mergeProductWithLiveCommerce(product, liveVariants);

	const attributeSlugs = attributeSlugsForProduct(storefrontProduct, allAttributes);
	const exactFromUrl = resolveExactVariantFromSearch(storefrontProduct, search, attributeSlugs);
	const variantForSeo = exactFromUrl ?? getDefaultVariant(storefrontProduct);

	if (storefrontProduct.categorySlug !== categoryMeta.slug) {
		redirect(productHref(storefrontProduct));
	}

	// Bad URL recovery (combination doesn't exist on any variant) is handled
	// client-side via `history.replaceState` (see usePdpUrlParams) so configurator
	// picks never refetch this RSC page.

	const [brand, seoSettings] = await Promise.all([getBrandBySlugCached(storefrontProduct.brandSlug, storefrontProduct.categorySlug), getSeoSettings()]);
	const brandName = brand?.name ?? storefrontProduct.brandSlug;
	const brandFilterHref = `${categoryHref(categoryMeta.slug)}?brand=${storefrontProduct.brandSlug}`;

	const productLd = productJsonLd({
		product: storefrontProduct,
		variant: variantForSeo,
		brand: brand ? { slug: brand.slug, name: brand.name } : null,
		category: { slug: categoryMeta.slug, label: categoryMeta.label },
		settings: seoSettings,
	});
	const breadcrumbLd = breadcrumbJsonLd([
		{ name: "Home", url: seoSettings.siteUrl },
		{
			name: categoryMeta.label,
			url: `${seoSettings.siteUrl}${categoryHref(categoryMeta.slug)}`,
		},
		{
			name: brandName,
			url: `${seoSettings.siteUrl}${brandFilterHref}`,
		},
		{
			name: `${brandName} ${storefrontProduct.name}`,
			url: productAbsoluteUrl(seoSettings.siteUrl, storefrontProduct, {
				variant: variantForSeo,
			}),
		},
	]);

	return (
		<VariantProvider product={storefrontProduct}>
			<PdpScrollReset />
			<ProductChatBeacon productId={storefrontProduct.id} productName={`${brandName} ${storefrontProduct.name}`} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(productLd) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(breadcrumbLd) }} />
			{/* Mobile */}
			<div className="pdp-shell reveal-stagger pb-[calc(80px+env(safe-area-inset-bottom,0px))] pt-2 md:hidden">
				<div className={`reveal space-y-3 ${STOREFRONT_SHELL_CLASS}`}>
					<Breadcrumbs categorySlug={categoryMeta.slug} categoryLabel={categoryMeta.label} brandName={brandName} brandFilterHref={brandFilterHref} modelName={storefrontProduct.name} />
					<div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
						<VariantAwareGallery product={storefrontProduct} brandName={brandName} layout="mobile" />
						<PdpOfferBadgeOverlay product={storefrontProduct} />
					</div>
				</div>

				<div className={`pdp-content ${STOREFRONT_SHELL_CLASS} space-y-5 pt-4`}>
					<div className="reveal">
						<Suspense fallback={<VariantSelectorSkeleton layout="mobile" product={storefrontProduct} brandName={brandName} />}>
							<VariantSelector product={storefrontProduct} brandName={brandName} />
						</Suspense>
					</div>

					<section className="reveal pdp-related-panel cv-auto">
						<div className="app-section-eyebrow mb-3">
							<span className="text-[var(--color-accent-800)]">More from {brandName}</span>
							<Link href={brandFilterHref}>See all</Link>
						</div>
						<Suspense fallback={<MobileRelatedRailSkeleton />}>
							<MobileRelatedRail product={storefrontProduct} brandName={brandName} />
						</Suspense>
					</section>
				</div>
			</div>

			{/* Desktop */}
			<div className={`pdp-shell reveal-stagger hidden pb-12 pt-8 md:block ${STOREFRONT_SHELL_CLASS}`}>
				<div className="reveal">
					<Breadcrumbs categorySlug={categoryMeta.slug} categoryLabel={categoryMeta.label} brandName={brandName} brandFilterHref={brandFilterHref} modelName={storefrontProduct.name} />
				</div>

				<div className="mt-6 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-10">
					<div className="reveal relative min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)]">
						<VariantAwareGallery product={storefrontProduct} brandName={brandName} layout="desktop" />
						<PdpOfferBadgeOverlay product={storefrontProduct} />
					</div>

					<div className="reveal flex min-h-0 min-w-0 flex-col">
						<Suspense fallback={<VariantSelectorSkeleton layout="desktop" product={storefrontProduct} brandName={brandName} />}>
							<VariantSelector product={storefrontProduct} brandName={brandName} />
						</Suspense>
					</div>
				</div>

				<section className="reveal pdp-related-panel cv-auto mt-16">
					<div className="flex items-end justify-between gap-3">
						<h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink-900)]">More from {brandName}</h2>
						<Link href={brandFilterHref} className="text-sm font-medium text-[var(--color-accent-700)] hover:underline">
							See all {brandName} →
						</Link>
					</div>
					<Suspense fallback={<DesktopRelatedRailSkeleton />}>
						<DesktopRelatedRail product={storefrontProduct} brandName={brandName} />
					</Suspense>
				</section>
			</div>
		</VariantProvider>
	);
}

/* ─────────────────────── Variant selector skeleton ─────────────────────── */

interface VariantSelectorSkeletonProps {
	layout: "mobile" | "desktop";
	product: Product;
	brandName: string;
}

/**
 * Shape-matched skeleton for the `<VariantSelector>` Suspense slot. We
 * already know the product name, brand, and which variants exist (from
 * the cached shell), so we paint everything except the parts that
 * depend on live commerce — price, stock count, "in stock" pill, and
 * the CTA. Those are the only blocks that shimmer.
 */
function VariantSelectorSkeleton({ layout, product, brandName }: VariantSelectorSkeletonProps) {
	const variantCount = Math.max(1, Math.min(product.variants.length, 6));
	if (layout === "mobile") {
		return (
			<div className="space-y-3">
				<div className="space-y-1.5">
					<p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">{brandName}</p>
					<h1 className="font-headline text-[24px] font-semibold leading-tight tracking-tight text-[var(--color-ink-900)]">{product.name}</h1>
				</div>
				<Skeleton shape="text" className="h-8 w-36" />
				<Skeleton shape="text" className="h-3 w-32" />
				<div className="flex flex-wrap gap-1.5">
					{Array.from({ length: variantCount }).map((_, index) => (
						<Skeleton key={index} className="h-9 w-24" />
					))}
				</div>
			</div>
		);
	}
	return (
		<div className="space-y-5">
			<div className="space-y-1.5">
				<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-700)]">{brandName}</p>
				<h1 className="font-headline text-[34px] font-semibold leading-[1.05] tracking-tight text-[var(--color-ink-900)]">{product.name}</h1>
			</div>
			<div className="space-y-1.5">
				<Skeleton shape="text" className="h-9 w-44" />
				<Skeleton shape="text" className="h-3 w-40" />
			</div>
			<div className="flex flex-wrap gap-1.5">
				{Array.from({ length: variantCount }).map((_, index) => (
					<Skeleton key={index} className="h-10 w-28" />
				))}
			</div>
			<Skeleton shape="pill" className="h-12 w-full" />
		</div>
	);
}

/* ─────────────────────── Related-products slots ─────────────────────── */

// `cache()` collapses the mobile + desktop rails into one call per render;
// `getProductsPageCached` shares results cross-request (30s) and dedupes in-flight.
const loadRelatedProducts = cache(async (product: Product): Promise<Product[]> => {
	const { products: relatedRaw } = await getProductsPageCached({
		categorySlug: product.categorySlug,
		brandSlugs: [product.brandSlug],
		limit: RELATED_PRODUCTS_POOL,
	});
	return relatedRaw.filter((candidate) => candidate.id !== product.id).slice(0, RELATED_PRODUCTS_DISPLAY_COUNT);
});

async function MobileRelatedRail({ product, brandName }: { product: Product; brandName: string }) {
	const related = await loadRelatedProducts(product);
	if (related.length === 0) {
		return (
			<p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 px-4 py-8 text-center text-[13px] text-[var(--color-ink-500)]">
				No more products from {brandName} right now.
			</p>
		);
	}
	return (
		<div className="reveal-scroll-list grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
			{related.map((relatedProduct) => (
				<div key={relatedProduct.id} className="reveal reveal-scroll reveal-rise h-full">
					<ProductCard product={relatedProduct} />
				</div>
			))}
		</div>
	);
}

async function DesktopRelatedRail({ product, brandName }: { product: Product; brandName: string }) {
	const related = await loadRelatedProducts(product);
	if (related.length === 0) {
		return (
			<p className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 px-6 py-10 text-center text-[14px] text-[var(--color-ink-500)]">
				No more products from {brandName} right now.
			</p>
		);
	}
	return (
		<div className="reveal-scroll-list mt-6 grid grid-cols-4 gap-5">
			{related.map((relatedProduct) => (
				<div key={relatedProduct.id} className="reveal reveal-scroll reveal-rise h-full">
					<ProductCard product={relatedProduct} />
				</div>
			))}
		</div>
	);
}

function MobileRelatedRailSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
			{Array.from({ length: RELATED_PRODUCTS_DISPLAY_COUNT }).map((_, index) => (
				<ProductCardSkeleton key={index} />
			))}
		</div>
	);
}

function DesktopRelatedRailSkeleton() {
	return (
		<div className="mt-6 grid grid-cols-4 gap-5">
			{Array.from({ length: RELATED_PRODUCTS_DISPLAY_COUNT }).map((_, index) => (
				<ProductCardSkeleton key={index} />
			))}
		</div>
	);
}

/* ─────────────────────── Static layout pieces ─────────────────────── */

interface BreadcrumbsProps {
	categorySlug: string;
	categoryLabel: string;
	brandName: string;
	brandFilterHref: string;
	modelName: string;
}

function Breadcrumbs({ categorySlug, categoryLabel, brandName, brandFilterHref, modelName }: BreadcrumbsProps) {
	return (
		<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-ink-500)] sm:gap-1.5 sm:text-sm">
			<Link href="/" className="hover:text-[var(--color-ink-800)]">
				Home
			</Link>
			<ChevronRight size={14} aria-hidden className="shrink-0" />
			<Link href={categoryHref(categorySlug)} className="hover:text-[var(--color-ink-800)]">
				{categoryLabel}
			</Link>
			<ChevronRight size={14} aria-hidden className="shrink-0" />
			<Link href={brandFilterHref} className="hover:text-[var(--color-ink-800)]">
				{brandName}
			</Link>
			<ChevronRight size={14} aria-hidden className="shrink-0" />
			<span className="text-[var(--color-ink-800)]">{modelName}</span>
		</nav>
	);
}
