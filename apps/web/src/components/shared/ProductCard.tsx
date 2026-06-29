"use client";

import { useMemo } from "react";
import Link from "next/link";

import { type Product, formatPrice } from "@store/shared";
import { productHref } from "@/lib/catalog/productPaths";
import { usePrefetchOnIntent } from "@/lib/navigation/usePrefetchOnIntent";
import { useActiveOffers } from "@/lib/pricing/useActiveOffers";
import { resolveProductCatalogDealOffers } from "@/lib/pricing/productOfferMatch";
import {
	formatProductVariantAvailabilityLabel,
	getProductPriceRange,
	isProductInStock,
	resolveListingVariant,
	resolveProductCardImageGrid,
} from "@/lib/productSummary";
import { useAttributesForCategory } from "@/lib/core/storefrontReferenceContext";

import { ProductDealAvailableBadge } from "./ProductDealAvailableBadge";
import { CARD_FOOTER_CHIP_SLOT_CLASS, OVERLAY_CHIP_ROW_MAX_PX, TITLE_CHIP_ROW_MAX_PX, getAttributeChipGroups } from "./productCardChipModel";
import { GroupedAttributeChipRow } from "./productCardChipRow";
import { ProductListingCountChip } from "./productCardCountChip";
import { ProductCardImageGrid } from "./productCardImageGrid";

interface ProductCardProps {
	product: Product;
	priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
	const brandName = product.brandName ?? product.brandSlug;
	const attributes = useAttributesForCategory(product.categorySlug);
	const inStock = isProductInStock(product);
	const variantCount = product.variants.length;
	const isUnavailable = !inStock || variantCount === 0;

	const cardImages = useMemo(() => resolveProductCardImageGrid(product), [product]);

	const href = useMemo(() => productHref(product, { variant: resolveListingVariant(product) }), [product]);

	const displayVariant = resolveListingVariant(product);
	const staticTitleChipGroups = getAttributeChipGroups({ ...product, variants: [displayVariant] }, attributes, "title-chips");
	const staticOverlayChipGroups = getAttributeChipGroups({ ...product, variants: [displayVariant] }, attributes, "image-overlay");

	const prefetchHandlers = usePrefetchOnIntent(href);

	const { offers } = useActiveOffers();

	const applicableOfferCount = useMemo(() => {
		if (offers.length === 0 || !inStock) {
			return 0;
		}
		return resolveProductCatalogDealOffers(product, offers).length;
	}, [product, inStock, offers]);

	const priceLabel = useMemo(() => {
		const priceRange = getProductPriceRange(product);
		if (!priceRange) {
			return null;
		}
		if (priceRange.min !== priceRange.max) {
			return `From ${formatPrice(priceRange.min)}`;
		}
		return formatPrice(priceRange.min);
	}, [product]);

	const variantAvailabilityLabel = useMemo(
		() => formatProductVariantAvailabilityLabel(product, attributes),
		[attributes, product],
	);

	const footerChips =
		staticTitleChipGroups.length > 0 ? <GroupedAttributeChipRow groups={staticTitleChipGroups} maxHeightPx={TITLE_CHIP_ROW_MAX_PX} /> : null;

	return (
		<Link
			href={href}
			className="group block h-full focus:outline-none"
			onPointerDown={prefetchHandlers.onPointerDown}
			onTouchStart={prefetchHandlers.onTouchStart}
			onFocus={prefetchHandlers.onFocus}
		>
			<div className="lift glass-shine relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] hover:border-[var(--color-ink-200)]">
				<div className="product-media-well relative aspect-square shrink-0 bg-[var(--color-canvas-deep)]">
					<ProductCardImageGrid
						images={cardImages}
						name={product.name}
						brandName={brandName}
						brandSlug={product.brandSlug}
						priority={priority}
					/>
					{applicableOfferCount > 0 ? (
						<div className="absolute left-1.5 top-1.5 z-10 md:left-3 md:top-3">
							<ProductDealAvailableBadge offerCount={applicableOfferCount} />
						</div>
					) : null}
					{staticOverlayChipGroups.length > 0 && (
						<div className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-12px)] md:bottom-3 md:left-3">
							<GroupedAttributeChipRow groups={staticOverlayChipGroups} maxHeightPx={OVERLAY_CHIP_ROW_MAX_PX} variant="overlay" />
						</div>
					)}
				</div>

				<div className="flex flex-1 flex-col">
					<div className="flex flex-1 flex-col gap-1 p-2 md:gap-1.5 md:p-2.5">
						<div className="space-y-0.5">
							<div className="flex items-center justify-between gap-2">
								<span className="line-clamp-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-500)]">{brandName}</span>
								{variantAvailabilityLabel ? <ProductListingCountChip label={variantAvailabilityLabel} /> : null}
							</div>
							<h3 className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-[var(--color-ink-900)] md:line-clamp-1 md:text-[15px]">
								{product.name}
							</h3>
						</div>
					</div>

					<div className="mt-auto border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-2 py-1.5 md:px-2.5 md:py-2">
						{priceLabel ? (
							<p className="text-[14px] font-bold tabular-nums tracking-tight text-[var(--color-ink-900)] md:text-[15px]">{priceLabel}</p>
						) : null}
						{footerChips ? <div className={`${CARD_FOOTER_CHIP_SLOT_CLASS} ${priceLabel ? "mt-1" : ""}`}>{footerChips}</div> : null}
					</div>
				</div>

				{isUnavailable ? (
					<div
						className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-[var(--color-ink-900)]/60"
						aria-hidden
					>
						<span className="rounded-[var(--radius-full)] bg-[var(--color-surface)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-ink-900)] shadow-[var(--shadow-md)] md:px-4 md:py-1.5 md:text-[11px]">
							{variantCount > 0 ? "Out of stock" : "Unavailable"}
						</span>
					</div>
				) : null}
			</div>
		</Link>
	);
}
