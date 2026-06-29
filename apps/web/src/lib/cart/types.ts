/**
 * Cart line shape — denormalised so the cart drawer / checkout can render
 * without re-fetching every product. Server re-validates pricing and stock on submit.
 */

import type { CartAppliedOfferLock, StoredImage } from "@store/shared";

export type { CartAppliedOfferLock };

export interface CartItem {
	/** Stable id used for React keys (`productId:variantId`). */
	id: string;
	productId: string;
	variantId: string;
	/** Display name (`Product.name`). */
	productName: string;
	brandSlug: string;
	/** Brand display name — denormalised for the cart row. */
	brandName: string;
	/** Multi-resolution hero image. */
	image: StoredImage;
	/** List price at time of add — server re-validates on order placement. */
	unitPriceRupees: number;
	/** URL category segment (`Product.categorySlug`). */
	categorySlug: string;
	/** Slug used to build a link back to the product page. */
	productSlug: string;
	/** Variant selections keyed by `Attribute.slug` (e.g. `{ storage: "256GB", colour: "Titanium" }`). */
	attributes: Record<string, string | string[]>;
	quantity: number;
	/** Variant stock cap captured when the line was added. */
	maxQuantity?: number;
	/** Catalog deal locked in when the line was added — honored until checkout completes. */
	appliedOffer?: CartAppliedOfferLock;
	/** Legacy cart lines — prefer `appliedOffer`. */
	appliedOfferId?: string;
}
