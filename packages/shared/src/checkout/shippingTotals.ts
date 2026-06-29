export interface CourierShippingInput {
	/** Storefront uses `delivery`; API uses `courier` — both mean shipped. */
	isCourierDelivery: boolean;
	subtotalAfterOffersRupees: number;
	freeDeliveryThresholdRupees: number;
	courierFlatFeeRupees: number;
	offerGrantsFreeShipping: boolean;
}

/**
 * Courier shipping fee after offers and free-delivery threshold.
 * Threshold 0 means every courier order pays the flat fee unless an offer grants free shipping.
 */
export function computeCourierShippingRupees(input: CourierShippingInput): number {
	if (!input.isCourierDelivery) {
		return 0;
	}
	if (input.offerGrantsFreeShipping) {
		return 0;
	}
	const threshold = Math.max(0, Math.floor(input.freeDeliveryThresholdRupees));
	const flatFee = Math.max(0, Math.floor(input.courierFlatFeeRupees));
	if (threshold <= 0) {
		return flatFee;
	}
	return input.subtotalAfterOffersRupees >= threshold ? 0 : flatFee;
}
