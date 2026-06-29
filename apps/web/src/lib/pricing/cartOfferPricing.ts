import type { ActiveOffer, EvaluatableItem, Product } from "@store/shared";
import { computeLockedItemOfferDiscount, resolveCartLineOfferId } from "@store/shared";

import type { CartItem } from "@/lib/cart/types";
import { buildEvaluatableItem } from "@/lib/pricing/productOfferMatch";

export function buildEvaluatableItemWithQuantity(product: Product, variant: Product["variants"][number], quantity: number): EvaluatableItem {
	return {
		...buildEvaluatableItem(product, variant),
		quantity,
	};
}

export function buildEvaluatableItemFromCartLine(line: CartItem): EvaluatableItem {
	return {
		id: line.id,
		productId: line.productId,
		variantId: line.variantId,
		categorySlug: line.categorySlug,
		brandSlug: line.brandSlug,
		price: line.unitPriceRupees,
		quantity: line.quantity,
		attributes: line.attributes ?? {},
	};
}

export function buildCartLineOfferIds(items: CartItem[]): Record<string, string | undefined> {
	return Object.fromEntries(items.map((line) => [line.id, resolveCartLineOfferId(line)]));
}

export function resolvePdpOfferUnitPrice(listUnitPriceRupees: number, item: EvaluatableItem, offer: ActiveOffer | null): { unitPriceRupees: number; hasOfferDiscount: boolean } {
	if (!offer) {
		return { unitPriceRupees: listUnitPriceRupees, hasOfferDiscount: false };
	}

	const context = {
		cartTotal: listUnitPriceRupees * item.quantity,
	};

	const discountRupees = computeLockedItemOfferDiscount(item, offer, context);
	if (discountRupees <= 0) {
		return { unitPriceRupees: listUnitPriceRupees, hasOfferDiscount: false };
	}

	const lineTotalRupees = listUnitPriceRupees * item.quantity;
	const saleLineTotalRupees = lineTotalRupees - discountRupees;
	const unitPriceRupees = Math.round(saleLineTotalRupees / item.quantity);

	return {
		unitPriceRupees,
		hasOfferDiscount: unitPriceRupees < listUnitPriceRupees,
	};
}

export { resolveOfferMinQuantity } from "@store/shared";
