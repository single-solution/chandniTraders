/**
 * Pure helpers for default variant, in-stock flags, and display values from a storefront `Product`.
 */

import type { Product, StoredImage, Variant } from "@store/shared";
import { formatPrice, isVariantInStock } from "@store/shared";

/**
 * Sensible "starting" variant for any product. Picks the cheapest in-stock
 * variant; falls back to the overall cheapest when nothing is in stock.
 * Stable across renders because we always pick from a deterministic order
 * (price asc, ties broken by id) — no flicker when re-fetching.
 */
export function getDefaultVariant(product: Product): Variant {
	const variants = product.variants;
	if (variants.length === 0) {
		return {
			id: "",
			priceRupees: 0,
			quantity: 0,
			forceOutOfStock: false,
			warrantyDays: 0,
			attributes: {},
		};
	}
	const inStock = variants.filter(isVariantInStock);
	const pool = inStock.length > 0 ? inStock : variants;
	return [...pool].sort((left, right) => {
		const priceDelta = left.priceRupees - right.priceRupees;
		if (priceDelta !== 0) {
			return priceDelta;
		}
		return left.id.localeCompare(right.id);
	})[0];
}

export function isProductInStock(product: Product): boolean {
	return product.variants.some(isVariantInStock);
}

export interface ProductPriceRange {
	min: number;
	max: number;
}

/** Min/max variant prices on a product (in-stock not required). */
export function getProductPriceRange(product: Product): ProductPriceRange | null {
	const prices = product.variants.map((variant) => variant.priceRupees).filter((price) => price > 0);
	if (prices.length === 0) {
		return null;
	}
	return {
		min: Math.min(...prices),
		max: Math.max(...prices),
	};
}

/** Hero image for a product — first entry in the default variant's gallery. */
export function resolveProductHeroImage(product: Product): StoredImage | undefined {
	const defaultVariant = getDefaultVariant(product);
	return defaultVariant.images?.[0];
}

function storedImageKey(image: StoredImage): string {
	return image.variants.card || image.variants.full;
}

/**
 * Up to `maxImages` unique gallery images for listing cards — pulls from
 * variant galleries in display order.
 */
export function resolveProductCardGalleryImages(product: Product, maxImages = 4): StoredImage[] {
	const seen = new Set<string>();
	const images: StoredImage[] = [];

	function addImage(image: StoredImage | undefined) {
		if (!image) {
			return;
		}
		const key = storedImageKey(image);
		if (!key || seen.has(key)) {
			return;
		}
		seen.add(key);
		images.push(image);
	}

	for (const variant of getVariantsInDisplayOrder(product.variants)) {
		for (const image of variant.images ?? []) {
			addImage(image);
			if (images.length >= maxImages) {
				return images;
			}
		}
	}

	return images;
}

/** Four cells for a 2×2 card grid — round-robin when fewer than four unique images. */
export function resolveProductCardImageGrid(product: Product): StoredImage[] {
	const uniqueImages = resolveProductCardGalleryImages(product, 4);
	if (uniqueImages.length < 2) {
		return uniqueImages;
	}
	const cells: StoredImage[] = [];
	for (let index = 0; index < 4; index += 1) {
		cells.push(uniqueImages[index % uniqueImages.length]);
	}
	return cells;
}

/**
 * Variant to link from shop cards — honours a single active grade filter;
 * grade-expanded grids pass a product scoped to one grade.
 */
export function resolveListingVariant(product: Product): Variant {
	if (product.variants.length === 1) {
		return product.variants[0];
	}
	return getDefaultVariant(product);
}

/** Variants in stable card order — cheapest in-stock first, then by id. */
export function getVariantsInDisplayOrder(variants: Variant[]): Variant[] {
	const inStock = variants.filter(isVariantInStock);
	const pool = inStock.length > 0 ? inStock : variants;
	return [...pool].sort((left, right) => {
		const priceDelta = left.priceRupees - right.priceRupees;
		if (priceDelta !== 0) {
			return priceDelta;
		}
		return left.id.localeCompare(right.id);
	});
}

export function formatProductVariantAvailabilityLabel(product: Product, attributes: ReturnType<typeof import("@/lib/core/storefrontReferenceContext").useAttributesForCategory>): string | null {
	const inStockVariants = product.variants.filter(isVariantInStock);
	if (inStockVariants.length === 0) {
		return null;
	}
	
	// Find the first attribute that varies across in-stock variants
	const varyingAttributeSlug = attributes.map(a => a.slug).find((slug) => {
		const values = new Set(inStockVariants.map((v) => v.attributes[slug]).filter(Boolean));
		return values.size > 1;
	});

	if (varyingAttributeSlug) {
		const attribute = attributes.find(a => a.slug === varyingAttributeSlug);
		if (attribute) {
			const count = new Set(inStockVariants.map((v) => v.attributes[varyingAttributeSlug]).filter(Boolean)).size;
			// e.g. "3 colors available"
			return `${count} ${attribute.label.toLowerCase()}${count === 1 ? "" : "s"} available`;
		}
	}

	const count = inStockVariants.length;
	if (count > 1) {
		return `${count} variants available`;
	}
	return null;
}
