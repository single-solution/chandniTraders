import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { logger } from "@store/shared";

import { ShopProductFeed } from "@/components/shared/ShopProductFeed";
import { ShopCategoryToolbar } from "@/app/_components/shop/ShopCategoryToolbar";
import { SHOP_CATEGORY_GRID_CLASS, SHOP_CATEGORY_PAGE_CLASS } from "@/lib/catalog/shopListingGrid";
import { ShopScrollReset } from "@/app/_components/shop/ShopScrollReset";
import { catalogRootHref, categoryHref } from "@/lib/catalog/productPaths";
import { ShopCatalogToolbarFallback, ShopProductsAreaFallback } from "@/components/shared/ShopListingSkeleton";
import { NavigationPendingFallback } from "@/components/shared/NavigationPendingFallback";
import { StructuredContentFull } from "@/components/shared/StructuredContent";
import { parseFiltersFromSearchParams, type CategoryMeta, type ProductFilters, type ProductPage } from "@/lib/core";
import { getCategoriesCached, getCategoryBySlugCached, getProductsPageCached } from "@/lib/core/cached";
import { composeCategorySeo } from "@/lib/seo/composeSeoMeta";
import { getSeoSettings } from "@/lib/seo/seoSettings";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLdScriptContent } from "@/lib/seo/jsonLd";

/**
 * Category listing page at `/shop/<categorySlug>`.
 */

// ISR on a 60s window: catalog edits from the admin propagate within a
// minute, but customers don't pay the cost of a 30-stage aggregation on
// every click. Mutations that need instant propagation should call
// `revalidateTag(STOREFRONT_CACHE_TAG)` from the admin server action.
export const revalidate = 60;

/** Pre-build active category listings at deploy so first visitors skip cold ISR. */
export async function generateStaticParams() {
	try {
		const categories = await getCategoriesCached();
		return categories
			.filter((category) => category.isActive)
			.map((category) => ({ category: category.slug }));
	} catch {
		return [];
	}
}

interface CategoryPageProps {
	params: Promise<{ category: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
	const { category } = await params;
	const meta = await getCategoryBySlugCached(category);
	if (!meta) {
		return { title: "Shop" };
	}
	const seoSettings = await getSeoSettings();
	const resolved = composeCategorySeo({
		category: {
			slug: meta.slug,
			label: meta.label,
			description: meta.description,
		},
		settings: seoSettings,
	});
	return {
		title: resolved.title,
		description: resolved.description,
		alternates: { canonical: resolved.canonical },
		robots: resolved.robots,
		openGraph: {
			title: resolved.title,
			description: resolved.description,
			url: resolved.canonical,
			type: "website",
			images: resolved.ogImageUrl ? [resolved.ogImageUrl] : undefined,
		},
		twitter: {
			card: resolved.twitterCard,
			title: resolved.title,
			description: resolved.description,
			images: resolved.ogImageUrl ? [resolved.ogImageUrl] : undefined,
		},
	};
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
	const [{ category }, rawSearchParams] = await Promise.all([params, searchParams]);
	const meta = await getCategoryBySlugCached(category);

	if (!meta) {
		notFound();
	}

	if (!meta.isActive) {
		return <ComingSoon meta={meta} />;
	}

	const filters = parseFiltersFromSearchParams(rawSearchParams, {
		categorySlug: meta.slug,
	});

	return (
		<>
			<Suspense fallback={null}>
				<ShopScrollReset />
			</Suspense>
			<Suspense fallback={null}>
				<CategoryJsonLd meta={meta} filters={filters} />
			</Suspense>

			<div id="shop-catalog" className={`${SHOP_CATEGORY_PAGE_CLASS} pb-10 md:pb-20`}>
				<div className="reveal reveal-rise">
					<Suspense fallback={<ShopCatalogToolbarFallback />}>
						<ShopCategoryToolbar activeSlug={meta.slug} filters={filters} />
					</Suspense>
				</div>

				<div className="shop-listing-mobile-scroll-pad pt-1">
					<Suspense fallback={<ShopProductsAreaFallback />}>
						<NavigationPendingFallback fallback={<ShopProductsAreaFallback />}>
							<ProductsArea meta={meta} filters={filters} />
						</NavigationPendingFallback>
					</Suspense>
				</div>
			</div>
		</>
	);
}

/* ─────────────────────────── Resilient reads ─────────────────────────── */

/**
 * Mirrors the `/deals` resilience pattern: a failed listing read degrades to
 * an empty page (and logs the real cause server-side) rather than 500-ing the
 * whole category route. ISR (`revalidate: 60`) retries on the next request.
 */
async function loadCategoryProducts(filters: ProductFilters): Promise<ProductPage> {
	try {
		return await getProductsPageCached(filters);
	} catch (error) {
		logger.error({ error }, "shop: category products load failed, serving empty page this render");
		return { products: [], total: 0, page: 1, pageSize: 0, pageCount: 1 };
	}
}

/* ──────────────────────────── JSON-LD slot ──────────────────────────── */

interface CategoryJsonLdProps {
	meta: CategoryMeta;
	filters: ProductFilters;
}

async function CategoryJsonLd({ meta, filters }: CategoryJsonLdProps) {
	const [page, seoSettings] = await Promise.all([loadCategoryProducts(filters), getSeoSettings()]);
	const collectionLd = collectionPageJsonLd({
		category: { slug: meta.slug, label: meta.label },
		products: page.products,
		settings: seoSettings,
	});
	const breadcrumbLd = breadcrumbJsonLd([
		{ name: "Home", url: seoSettings.siteUrl },
		{ name: meta.label, url: `${seoSettings.siteUrl}${categoryHref(meta.slug)}` },
	]);
	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(collectionLd) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(breadcrumbLd) }} />
		</>
	);
}

/* ─────────────────────── Async RSC section loaders ─────────────────────── */

interface ProductsAreaProps {
	meta: CategoryMeta;
	filters: ProductFilters;
}

async function ProductsArea({ meta, filters }: ProductsAreaProps) {
	const page = await loadCategoryProducts(filters);
	return <ShopProductFeed initialPage={page} categoryLabel={meta.label} apiParams={{ category: meta.slug }} gridClassName={SHOP_CATEGORY_GRID_CLASS} />;
}

/* ─────────────────────── Static, data-free pieces ─────────────────────── */

function ComingSoon({ meta }: { meta: CategoryMeta }) {
	return (
		<div className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-center md:pt-24">
			<p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-700)]">Coming soon</p>
			<h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink-900)] md:text-4xl">{meta.label}</h1>
			<StructuredContentFull
				content={meta.content}
				fallback={meta.description}
				iconColor="var(--color-accent-700)"
				iconSize={14}
				iconSizeClass="size-[14px]"
				className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-ink-600)]"
				bulletItemClassName="justify-center text-[13.5px] text-[var(--color-ink-700)]"
			/>
			<Link
				href={catalogRootHref()}
				className="mt-6 inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-ink-300)]"
			>
				Browse other shops →
			</Link>
		</div>
	);
}
