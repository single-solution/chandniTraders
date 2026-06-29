/** Fields needed to decide storefront/cart availability for a variant row. */
export type VariantStockFields = {
	quantity?: number | null;
	forceOutOfStock?: boolean | null;
};

/** Admin override — variant reads as sold out while `quantity` stays unchanged. */
export function isVariantForceOutOfStock(variant: VariantStockFields): boolean {
	return variant.forceOutOfStock === true;
}

/** Shoppable when not forced sold out and quantity is positive. */
export function isVariantInStock(variant: VariantStockFields): boolean {
	if (isVariantForceOutOfStock(variant)) {
		return false;
	}
	return (variant.quantity ?? 0) > 0;
}
