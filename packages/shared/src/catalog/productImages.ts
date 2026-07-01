import type { Product, Variant } from "../types";
import type { StoredImage } from "../storage/types";

export const MAX_PRODUCT_IMAGES = 24;

/** Variant gallery. Product-level global images are no longer used. */
export function resolveVariantGalleryImages(product: Pick<Product, "images">, variant: Pick<Variant, "images">): StoredImage[] {
	return variant.images && variant.images.length > 0 ? variant.images : [];
}

/** First image from {@link resolveVariantGalleryImages}. */
export function resolveVariantHeroImage(product: Pick<Product, "images">, variant: Pick<Variant, "images">): StoredImage | undefined {
	return resolveVariantGalleryImages(product, variant)[0];
}
