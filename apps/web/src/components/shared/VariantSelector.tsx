"use client";

import { useMemo, useState } from "react";
import { Check, MessageCircle, Settings2, ShoppingBag } from "lucide-react";

import {
	buildWhatsAppLink,
	classNames,
	formatPrice,
	isVariantInStock,
	type AttributeDescriptor,
	type Product,
	type Variant,
} from "@store/shared";

import { toAttributeLabelSource } from "@/lib/catalog/attributeLabels";

import { Button } from "@store/ui";
import { QuantityStepper } from "@store/ui";
import { useToast } from "@/components/ui/Toast";
import { useVariantSelection } from "@/components/shared/VariantContext";
import { useActiveOffers } from "@/lib/pricing/useActiveOffers";
import { buildEvaluatableItemWithQuantity, resolveOfferMinQuantity, resolvePdpOfferUnitPrice } from "@/lib/pricing/cartOfferPricing";
import { resolveProductCatalogDealOffers, resolveVariantCatalogDealOffers } from "@/lib/pricing/productOfferMatch";

import { attributeValuesOnVariant, findVariantBySelection, getRequiredAttributeSlugsForProduct, isPdpSelectionComplete, variantMatchesSelection } from "@/lib/catalog/pdpSelection";
import { CART_MAX_LINES } from "@/lib/cart/store";
import { useCart } from "@/lib/cart/useCart";
import type { CartItem } from "@/lib/cart/types";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { useProductAttributeScope } from "@/lib/catalog/productAttributeScope";
import { useCategories } from "@/lib/core/storefrontReferenceContext";

import { Configurator, ClosestMatchNotice } from "./variantSelectorConfigurator";
import { PdpOfferGuidance } from "./PdpOfferGuidance";
import { resolveProductHeroImage } from "@/lib/productSummary";
import { buildDimensions, describePickRealignment, describeSelection, EMPTY_VARIANT } from "./variantSelectorDimensions";
import { MobileStickyCta, PurchaseSummary } from "./variantSelectorPurchase";

const ADD_TO_CART_FLASH_MS = 1_500;
const REALIGNMENT_NOTICE_MS = 6_000;

function cartLineMatchesSelection(line: CartItem, selection: Record<string, string>): boolean {
	const pseudoVariant: Variant = {
		id: line.variantId,
		priceRupees: line.unitPriceRupees,
		quantity: line.maxQuantity ?? 0,
		forceOutOfStock: false,
		attributes: line.attributes ?? {},
	};
	return variantMatchesSelection(pseudoVariant, selection);
}

function quantityInCartForSelection(items: CartItem[], productId: string, selection: Record<string, string>): number {
	return items
		.filter((line) => line.productId === productId && cartLineMatchesSelection(line, selection))
		.reduce((sum, line) => sum + line.quantity, 0);
}

interface VariantSelectorProps {
	product: Product;
	brandName: string;
}

/**
 * Product detail configurator — instead of one row per variant, the
 * shopper picks each attribute independently
 * and the selector resolves to the matching variant. When a combination
 * isn't stocked, the closest variant is auto-selected with an inline
 * "ask on WhatsApp" hint.
 */
export function VariantSelector({ product, brandName }: VariantSelectorProps) {
	const { selectedVariantId, currentSelection, pick: pickSelection } = useVariantSelection();
	const cart = useCart();
	const { toast } = useToast();
	const [hasJustBeenAdded, setHasJustBeenAdded] = useState(false);
	const [addQuantityState, setAddQuantityState] = useState({ variantId: selectedVariantId, quantity: 1 });
	const [realignmentNotice, setRealignmentNotice] = useState<string | null>(null);
	const [realignmentDimensionKey, setRealignmentDimensionKey] = useState<string | null>(null);
	const { config: productAttributeConfig, attributes: categoryAttributes } = useProductAttributeScope(product);
	const categories = useCategories();
	const categoryLabelsBySlug = useMemo(
		() => Object.fromEntries(categories.map((category) => [category.slug, category.label])),
		[categories],
	);
	const attributeSlugs = useMemo(() => categoryAttributes.map((row) => row.slug), [categoryAttributes]);
	const requiredAttributeSlugs = useMemo(() => getRequiredAttributeSlugsForProduct(product, attributeSlugs), [product, attributeSlugs]);
	const requiredAttributeLabels = useMemo(
		() => requiredAttributeSlugs.map((slug) => categoryAttributes.find((row) => row.slug === slug)?.label ?? slug),
		[requiredAttributeSlugs, categoryAttributes],
	);
	const dimensions = useMemo(() => buildDimensions(product, categoryAttributes, productAttributeConfig), [product, categoryAttributes, productAttributeConfig]);

	const selected = useMemo(() => {
		if (isPdpSelectionComplete(currentSelection, requiredAttributeSlugs)) {
			return findVariantBySelection(product.variants, currentSelection) ?? EMPTY_VARIANT;
		}
		if (!selectedVariantId) {
			return EMPTY_VARIANT;
		}
		return product.variants.find((variant) => variant.id === selectedVariantId) ?? EMPTY_VARIANT;
	}, [currentSelection, product.variants, requiredAttributeSlugs, selectedVariantId]);

	if (addQuantityState.variantId !== selectedVariantId) {
		setAddQuantityState({ variantId: selectedVariantId, quantity: 1 });
	}

	const addQuantity = addQuantityState.quantity;
	function setAddQuantity(quantity: number) {
		setAddQuantityState((current) => ({ ...current, quantity }));
	}

	const resolvedVariant = useMemo(() => findVariantBySelection(product.variants, currentSelection), [product.variants, currentSelection]);

	const isExactMatch = Boolean(resolvedVariant);
	const isComplete = useMemo(() => isPdpSelectionComplete(currentSelection, requiredAttributeSlugs), [currentSelection, requiredAttributeSlugs]);
	const missingAttributeLabels = useMemo(
		() => requiredAttributeSlugs.map((slug, index) => (currentSelection[slug] ? null : requiredAttributeLabels[index])).filter((label): label is string => Boolean(label)),
		[currentSelection, requiredAttributeSlugs, requiredAttributeLabels],
	);

	const inStock = isVariantInStock(selected);
	const stockQuantity = Math.max(0, selected.quantity ?? 0);
	const quantityInCart = useMemo(() => {
		if (isPdpSelectionComplete(currentSelection, requiredAttributeSlugs)) {
			return quantityInCartForSelection(cart.items, product.id, currentSelection);
		}
		if (!selected.id) {
			return 0;
		}
		return cart.items.find((line) => line.id === `${product.id}:${selected.id}`)?.quantity ?? 0;
	}, [cart.items, currentSelection, product.id, requiredAttributeSlugs, selected.id]);
	const remainingStock = Math.max(0, stockQuantity - quantityInCart);
	const maxSelectableQuantity = remainingStock;

	const handlePick = (dimensionKey: string, optionKey: string) => {
		const result = pickSelection(dimensionKey, optionKey);
		const message = describePickRealignment(dimensions, result.before, result.after, result.clickedDimensionKey);
		if (message) {
			setRealignmentNotice(message);
			setRealignmentDimensionKey(dimensionKey);
			window.setTimeout(() => {
				setRealignmentNotice((current) => (current === message ? null : current));
				setRealignmentDimensionKey((currentKey) => (currentKey === dimensionKey ? null : currentKey));
			}, REALIGNMENT_NOTICE_MS);
		} else {
			setRealignmentNotice(null);
			setRealignmentDimensionKey(null);
		}
	};
	const heroImage = resolveProductHeroImage(product);

	const { offers } = useActiveOffers();
	const productOffers = useMemo(() => resolveProductCatalogDealOffers(product, offers), [offers, product]);
	const variantOffers = useMemo(() => {
		if (!selected.id) {
			return [];
		}
		return resolveVariantCatalogDealOffers(product, selected, offers);
	}, [offers, product, selected]);

	const selectedOfferId = variantOffers[0]?.id ?? null;
	const selectedOffer = variantOffers[0] ?? null;

	const offerMinQuantity = useMemo(() => {
		if (!selectedOffer || !inStock) {
			return 1;
		}
		const requiredQuantity = resolveOfferMinQuantity(selectedOffer);
		if (requiredQuantity <= 1 || maxSelectableQuantity < requiredQuantity) {
			return 1;
		}
		return requiredQuantity;
	}, [selectedOffer, inStock, maxSelectableQuantity]);

	const orderQuantity = maxSelectableQuantity > 0 ? Math.min(Math.max(addQuantity, offerMinQuantity), maxSelectableQuantity) : Math.max(addQuantity, offerMinQuantity);

	const { minPrice, maxPrice } = useMemo(() => {
		const prices = product.variants.map((v) => v.priceRupees).filter((p) => typeof p === "number" && p > 0);
		if (prices.length === 0) return { minPrice: undefined, maxPrice: undefined };
		return { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
	}, [product.variants]);

	const listUnitPriceRupees = selected.priceRupees;
	const pricedItem = useMemo(() => {
		if (!selected.id) {
			return null;
		}
		return buildEvaluatableItemWithQuantity(product, selected, orderQuantity);
	}, [orderQuantity, product, selected]);

	const { unitPriceRupees: saleUnitPriceRupees } = useMemo(() => {
		if (!pricedItem) {
			return { unitPriceRupees: listUnitPriceRupees, hasOfferDiscount: false };
		}
		return resolvePdpOfferUnitPrice(listUnitPriceRupees, pricedItem, selectedOffer);
	}, [listUnitPriceRupees, pricedItem, selectedOffer]);

	const attributeSummary = useMemo(() => describeSelection(selected, categoryAttributes), [selected, categoryAttributes]);

	const whatsappMessage = `Salam! I'd like to order the ${brandName} ${product.name}${
		attributeSummary ? ` (${attributeSummary})` : ""
	} for ${formatPrice(saleUnitPriceRupees)}.`;

	const handleAddToCart = () => {
		if (!selected.id || !heroImage || !inStock) {
			return;
		}
		const quantityToAdd = orderQuantity;
		if (quantityToAdd <= 0) {
			return;
		}
		const added = cart.addItem({
			productId: product.id,
			variantId: selected.id,
			productName: product.name,
			brandSlug: product.brandSlug,
			brandName,
			image: heroImage,
			unitPriceRupees: selected.priceRupees,
			categorySlug: product.categorySlug,
			productSlug: product.slug,
			attributes: selected.attributes ?? {},
			quantity: quantityToAdd,
			maxQuantity: stockQuantity,
			...(selectedOffer
				? {
						appliedOffer: {
							id: selectedOffer.id,
							title: selectedOffer.title,
							lockedAt: new Date().toISOString(),
						},
					}
				: {}),
		});
		if (!added) {
			toast(`Cart is full — you can hold up to ${CART_MAX_LINES} different items.`, {
				tone: "info",
			});
			return;
		}
		setHasJustBeenAdded(true);
		window.setTimeout(() => setHasJustBeenAdded(false), ADD_TO_CART_FLASH_MS);
		toast(`${product.name} added to cart`);
	};

	return (
		<div className="space-y-3 md:flex md:h-full md:min-h-0 md:flex-col md:space-y-0">
			{/* Title + configurator stay grouped at the top of the column. Any
          leftover vertical space inside the right-hand column shows up as a
          gap between this group and the price block below it, so the price
          stays pinned to the bottom of the gallery's height without the
          configurator floating in the middle. */}
			<div className="space-y-3 md:flex md:min-h-0 md:flex-col md:gap-3 md:space-y-0">
				<header className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-accent-50)]/40 px-3 py-2.5 shadow-[var(--shadow-sm)] md:px-4 md:py-3">
					<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)] md:text-[11px]">{brandName}</p>
					<h1 className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-[var(--color-ink-900)] sm:text-xl md:mt-1 md:text-4xl md:leading-[1.08] md:tracking-[-0.02em]">
						{product.name}
					</h1>
				</header>

				{productOffers.length > 0 ? (
					<PdpOfferGuidance
						offers={productOffers}
						appliedOfferId={selectedOfferId}
						product={product}
						brandName={brandName}
						categoryAttributes={categoryAttributes}
						categoryLabelsBySlug={categoryLabelsBySlug}
					/>
				) : null}

				<Configurator
					dimensions={dimensions}
					variants={product.variants}
					currentSelection={currentSelection}
					onPick={handlePick}
					realignmentNotice={realignmentNotice}
					realignmentDimensionKey={realignmentDimensionKey}
				/>

				{!isExactMatch && isComplete && <ClosestMatchNotice brandName={brandName} productName={product.name} summary={attributeSummary} whatsappMessage={whatsappMessage} />}
			</div>

			<div className="shrink-0 space-y-3 md:mt-4 md:pt-3">
				<PurchaseSummary
					isComplete={isComplete}
					missingAttributeLabels={missingAttributeLabels}
					minPrice={minPrice}
					maxPrice={maxPrice}
					isInStock={inStock}
					stockQuantity={stockQuantity}
					remainingStock={remainingStock}
					listPriceRupees={listUnitPriceRupees}
					saleUnitPriceRupees={saleUnitPriceRupees}
					quantity={orderQuantity}
					maxQuantity={maxSelectableQuantity}
					onQuantityChange={setAddQuantity}
					onAddToCart={handleAddToCart}
					hasJustBeenAdded={hasJustBeenAdded}
				/>
			</div>

			<MobileStickyCta
				isComplete={isComplete}
				missingAttributeLabels={missingAttributeLabels}
				minPrice={minPrice}
				maxPrice={maxPrice}
				onAddToCart={handleAddToCart}
				hasJustBeenAdded={hasJustBeenAdded}
				listPriceRupees={listUnitPriceRupees}
				saleUnitPriceRupees={saleUnitPriceRupees}
				isInStock={inStock}
				stockQuantity={stockQuantity}
				remainingStock={remainingStock}
				quantity={orderQuantity}
				maxQuantity={maxSelectableQuantity}
				onQuantityChange={setAddQuantity}
			/>
		</div>
	);
}
