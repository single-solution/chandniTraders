import type { Product, Variant } from "../types";
import type { StoredImage } from "../storage/types";

export const MAX_PRODUCT_IMAGES = 24;

/** Variant gallery when present, combined with product-level gallery. */
export function resolveVariantGalleryImages(product: Pick<Product, "images">, variant: Pick<Variant, "images">): StoredImage[] {
	if (variant.images && variant.images.length > 0) {
		const seen = new Set<string>();
		const combined: StoredImage[] = [];
		
		for (const img of variant.images) {
			const key = img.variants.full || img.variants.detail || img.variants.card;
			if (key && !seen.has(key)) {
				seen.add(key);
				combined.push(img);
			}
		}
		
		for (const img of product.images ?? []) {
			const key = img.variants.full || img.variants.detail || img.variants.card;
			if (key && !seen.has(key)) {
				seen.add(key);
				combined.push(img);
			}
		}
		
		return combined;
	}
	return product.images ?? [];
}

/** First image from {@link resolveVariantGalleryImages}. */
export function resolveVariantHeroImage(product: Pick<Product, "images">, variant: Pick<Variant, "images">): StoredImage | undefined {
	return resolveVariantGalleryImages(product, variant)[0];
}
