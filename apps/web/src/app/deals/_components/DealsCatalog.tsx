"use client";

import { useCallback, useEffect, useState } from "react";

import { DealsOffersPanel } from "@/app/deals/_components/DealsOffersPanel";
import { ShopProductFeed } from "@/components/shared/ShopProductFeed";
import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import type { ProductPage } from "@/lib/core";
import { SHOP_CATEGORY_GRID_CLASS } from "@/lib/catalog/shopListingGrid";
import { filterProductsForOffer } from "@/lib/pricing/productOfferMatch";
import { useActiveOffers } from "@/lib/pricing/useActiveOffers";
import type { Offer } from "@store/shared";

interface DealsCatalogProps {
	catalogDeals: Offer[];
	productPage: ProductPage;
}

const DEALS_PRODUCT_API_PARAMS = {
	[FILTER_PARAM_KEYS.inStock]: "1",
	[FILTER_PARAM_KEYS.sort]: "recently-updated",
} as const;

function buildOfferProductsUrl(offerSlug: string, pageSize: number): string {
	const params = new URLSearchParams({
		offer: offerSlug,
		[FILTER_PARAM_KEYS.inStock]: "1",
		[FILTER_PARAM_KEYS.sort]: "recently-updated",
		limit: String(pageSize),
		page: "1",
	});
	return `/api/products?${params.toString()}`;
}

function syncOfferHash(slug: string): void {
	if (typeof window === "undefined") {
		return;
	}
	const url = new URL(window.location.href);
	url.hash = slug;
	window.history.replaceState(window.history.state, "", url.toString());
}

function resolveInitialDealSlug(catalogDeals: Offer[]): string | null {
	if (catalogDeals.length === 0) {
		return null;
	}
	if (typeof window !== "undefined") {
		const hashSlug = window.location.hash.slice(1);
		if (catalogDeals.some((offer) => offer.slug === hashSlug)) {
			return hashSlug;
		}
	}
	return catalogDeals[0]?.slug ?? null;
}

export function DealsCatalog({ catalogDeals, productPage }: DealsCatalogProps) {
	const { offers: activeOffers } = useActiveOffers();
	const [activeSlug, setActiveSlug] = useState<string | null>(() => resolveInitialDealSlug(catalogDeals));
	const [feedInitial, setFeedInitial] = useState(productPage);
	const [isLoadingProducts, setIsLoadingProducts] = useState(false);

	const activeOffer = catalogDeals.find((offer) => offer.slug === activeSlug) ?? null;

	const handleActiveSlugChange = useCallback(
		(slug: string) => {
			setActiveSlug(slug);
			syncOfferHash(slug);

			const storefrontOffer = catalogDeals.find((offer) => offer.slug === slug);
			const rules = activeOffers.find((offer) => offer.id === storefrontOffer?.id);
			if (!rules) {
				return;
			}

			const previewProducts = filterProductsForOffer(productPage.products, rules, productPage.products.length);
			setFeedInitial({
				...productPage,
				products: previewProducts,
				total: previewProducts.length,
				page: 1,
				pageCount: 1,
			});
		},
		[activeOffers, catalogDeals, productPage],
	);

	useEffect(() => {
		if (catalogDeals.length === 0) {
			return;
		}
		const slug = resolveInitialDealSlug(catalogDeals);
		if (!slug) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect -- sync hash + offer preview when catalog seeds load
		handleActiveSlugChange(slug);
	}, [catalogDeals, handleActiveSlugChange]);

	useEffect(() => {
		if (!activeSlug) {
			return;
		}

		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async offer product fetch
		setIsLoadingProducts(true);

		void (async () => {
			try {
				const response = await fetch(buildOfferProductsUrl(activeSlug, productPage.pageSize));
				if (!response.ok) {
					throw new Error(`offer products failed: ${response.status}`);
				}
				const nextPage = (await response.json()) as ProductPage;
				if (!cancelled) {
					setFeedInitial(nextPage);
				}
			} catch {
				// Preview from SSR seed stays visible on fetch failure.
			} finally {
				if (!cancelled) {
					setIsLoadingProducts(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [activeSlug, productPage.pageSize]);

	const displayInitial = feedInitial;
	const productApiParams = activeSlug ? { ...DEALS_PRODUCT_API_PARAMS, offer: activeSlug } : DEALS_PRODUCT_API_PARAMS;

	return (
		<>
			{catalogDeals.length > 0 ? (
				<section className="pt-2 pb-6 md:pt-4 md:pb-8">
					<DealsOffersPanel catalogDeals={catalogDeals} activeSlug={activeSlug} onActiveSlugChange={handleActiveSlugChange} />

					{activeOffer ? (
						<h2 className="mb-4 mt-6 text-[15px] font-semibold tracking-tight text-[var(--color-ink-900)] md:mb-5 md:mt-8 md:text-2xl">
							{activeOffer.title} products
						</h2>
					) : null}

					{isLoadingProducts && displayInitial.products.length === 0 ? (
						<ProductGridSkeleton count={productPage.pageSize} className={SHOP_CATEGORY_GRID_CLASS} />
					) : (
						<ShopProductFeed
							key={activeSlug ?? "deals"}
							initialPage={displayInitial}
							categoryLabel="products"
							apiParams={productApiParams}
							gridClassName={SHOP_CATEGORY_GRID_CLASS}
						/>
					)}
				</section>
			) : (
				<div className="app-page pb-8 md:pb-16">
					<div className="reveal mx-auto max-w-lg rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 p-10 text-center text-[13px] text-[var(--color-ink-500)] md:mt-12">
						No active deals right now — fresh ones every Friday.
					</div>
				</div>
			)}
		</>
	);
}
