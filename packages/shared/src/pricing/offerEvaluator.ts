import type { OfferAction, OfferSchedule } from "./offerTypes";
import {
	cartMatchesOffer,
	getMatchedCartItems,
	isCheckoutNoticeOffer,
	isCheckoutOnlyOffer,
	itemMatchesStorefrontScope,
	type EvaluateOffersOptions,
	type OfferMatchContext,
} from "./offerMatching";
import { isOfferEligible } from "./offerSchedule";

export interface EvaluatableItem {
	id: string;
	productId: string;
	variantId: string;
	categorySlug: string;
	brandSlug: string;
	price: number;
	quantity: number;
	attributes: Record<string, string | string[]>;
}

export interface ActiveOffer {
	id: string;
	title: string;
	/** Short label for product-card / gallery badges. */
	badgeLabel?: string;
	conditions: import("./offerTypes").OfferCondition[];
	action: OfferAction;
	schedule: OfferSchedule;
	isStackable: boolean;
	allowLoyaltyPoints: boolean;
	/** Max total redemptions; `undefined`/`0` means unlimited. */
	usageLimit?: number;
	/** Redemptions so far — used with `usageLimit` to retire exhausted offers. */
	usageCount?: number;
}

export interface DiscountApplication {
	offerId: string;
	offerTitle: string;
	discountAmount: number;
}

export interface OfferEvaluationResult {
	itemDiscounts: Map<string, DiscountApplication[]>;
	cartDiscounts: DiscountApplication[];
	totalDiscount: number;
	finalTotal: number;
	isLoyaltyPointsAllowed: boolean;
	/** True when an applicable offer grants free shipping. */
	freeShipping: boolean;
	/** IDs of offers that actually applied — used to bump `usageCount`. */
	appliedOfferIds: string[];
}

export type EvaluateCartOffersOptions = EvaluateOffersOptions & {
	/** Per line id → offer chosen on the PDP (stored on cart lines). */
	lineOfferIds?: Record<string, string | undefined>;
	/** Cart-locked catalog offers — honored even when schedule/usage has lapsed. */
	lockedCatalogOffers?: ActiveOffer[];
};

export interface LockedItemOfferOptions {
	/** Honor a cart lock even when the offer is no longer eligible in the catalog. */
	honorLock?: boolean;
}

export { isOfferActiveSchedule, isOfferEligible, isOfferUsageExhausted } from "./offerSchedule";

const PERCENTAGE_DIVISOR = 100;

/** Minimum line quantity required by offer rules — defaults to 1. */
export function resolveOfferMinQuantity(offer: ActiveOffer): number {
	for (const condition of offer.conditions) {
		if (condition.type !== "min_quantity" || condition.operator !== "gte") {
			continue;
		}
		const value = Number(condition.value);
		if (Number.isFinite(value) && value > 0) {
			return Math.floor(value);
		}
	}
	return 1;
}

/** PDP / cart-locked item offer — storefront item scope + quantity rules. */
export function itemMatchesLockedItemOffer(
	item: EvaluatableItem,
	offer: ActiveOffer,
	context: OfferMatchContext,
	options: LockedItemOfferOptions = {},
): boolean {
	if (!options.honorLock && !isOfferEligible(offer)) {
		return false;
	}
	if (isCheckoutOnlyOffer(offer)) {
		return false;
	}
	if (!itemMatchesStorefrontScope(item, offer, context)) {
		return false;
	}
	return item.quantity >= resolveOfferMinQuantity(offer);
}

/** Discount for a PDP-locked item offer — line-level % or fixed amount. */
export function computeLockedItemOfferDiscount(
	item: EvaluatableItem,
	offer: ActiveOffer,
	context: OfferMatchContext,
	options: LockedItemOfferOptions = {},
): number {
	if (!itemMatchesLockedItemOffer(item, offer, context, options)) {
		return 0;
	}
	if (offer.action.type === "buy_x_get_y" || offer.action.type === "free_shipping") {
		return 0;
	}

	const lineTotal = item.price * item.quantity;
	if (offer.action.type === "percentage_discount") {
		return lineTotal * (offer.action.value / PERCENTAGE_DIVISOR);
	}
	if (offer.action.type === "fixed_amount_discount") {
		return Math.min(offer.action.value * item.quantity, lineTotal);
	}
	return 0;
}

/** Discount amount for one line when a specific item-scoped offer applies. */
export function computeItemOfferDiscount(item: EvaluatableItem, offer: ActiveOffer): number {
	if (offer.action.type === "buy_x_get_y") {
		return 0;
	}
	if (offer.action.type === "free_shipping") {
		return 0;
	}
	if (offer.action.target !== "matched_items") {
		return 0;
	}

	const lineTotal = item.price * item.quantity;
	if (offer.action.type === "percentage_discount") {
		return lineTotal * (offer.action.value / PERCENTAGE_DIVISOR);
	}
	if (offer.action.type === "fixed_amount_discount") {
		return Math.min(offer.action.value * item.quantity, lineTotal);
	}
	return 0;
}

function applyCartWideOffer(
	offer: ActiveOffer,
	cartTotal: number,
	context: OfferMatchContext,
	cartDiscounts: DiscountApplication[],
): { cartTotal: number; totalDiscount: number; applied: boolean; freeShipping: boolean } {
	if (offer.action.type === "free_shipping") {
		return { cartTotal, totalDiscount: 0, applied: true, freeShipping: true };
	}
	if (offer.action.type === "buy_x_get_y") {
		return { cartTotal, totalDiscount: 0, applied: false, freeShipping: false };
	}
	if (offer.action.target !== "cart_total") {
		return { cartTotal, totalDiscount: 0, applied: false, freeShipping: false };
	}

	let offerDiscount = 0;
	if (offer.action.type === "percentage_discount") {
		offerDiscount = cartTotal * (offer.action.value / PERCENTAGE_DIVISOR);
	} else if (offer.action.type === "fixed_amount_discount") {
		offerDiscount = Math.min(offer.action.value, cartTotal);
	}

	if (offerDiscount <= 0) {
		return { cartTotal, totalDiscount: 0, applied: false, freeShipping: false };
	}

	cartDiscounts.push({
		offerId: offer.id,
		offerTitle: offer.title,
		discountAmount: offerDiscount,
	});
	return {
		cartTotal: cartTotal - offerDiscount,
		totalDiscount: offerDiscount,
		applied: true,
		freeShipping: false,
	};
}

/** Cart pricing — PDP-locked item offers first, then cart/checkout-wide offers. */
export function evaluateCartOffers(items: EvaluatableItem[], offers: ActiveOffer[], options: EvaluateCartOffersOptions = {}): OfferEvaluationResult {
	let cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	let totalDiscount = 0;

	const context: OfferMatchContext = {
		cartTotal,
		paymentMethod: options.paymentMethod,
	};

	const validOffers = offers.filter((offer) => isOfferEligible(offer));
	const lockedOfferById = new Map((options.lockedCatalogOffers ?? []).map((offer) => [offer.id, offer]));
	const offerById = new Map<string, ActiveOffer>();
	for (const offer of validOffers) {
		offerById.set(offer.id, offer);
	}
	for (const offer of options.lockedCatalogOffers ?? []) {
		if (!offerById.has(offer.id)) {
			offerById.set(offer.id, offer);
		}
	}

	const itemDiscounts = new Map<string, DiscountApplication[]>();
	const cartDiscounts: DiscountApplication[] = [];
	const appliedOfferIds: string[] = [];

	let isLoyaltyPointsAllowed = true;
	let freeShipping = false;

	for (const item of items) {
		const lockedOfferId = options.lineOfferIds?.[item.id];
		if (!lockedOfferId) {
			continue;
		}
		const offer = offerById.get(lockedOfferId);
		if (!offer || isCheckoutOnlyOffer(offer)) {
			continue;
		}

		const honorLock = lockedOfferById.has(lockedOfferId);

		if (offer.action.type === "free_shipping") {
			if (!itemMatchesLockedItemOffer(item, offer, context, { honorLock })) {
				continue;
			}
			freeShipping = true;
			appliedOfferIds.push(offer.id);
			continue;
		}

		const itemDiscount = computeLockedItemOfferDiscount(item, offer, context, { honorLock });
		if (itemDiscount <= 0) {
			continue;
		}

		itemDiscounts.set(item.id, [
			{
				offerId: offer.id,
				offerTitle: offer.title,
				discountAmount: itemDiscount,
			},
		]);
		totalDiscount += itemDiscount;
		cartTotal -= itemDiscount;
		appliedOfferIds.push(offer.id);
	}

	context.cartTotal = cartTotal;

	for (const offer of validOffers) {
		if (!isCheckoutNoticeOffer(offer)) {
			continue;
		}
		if (appliedOfferIds.includes(offer.id)) {
			continue;
		}

		const hasItemConditions = offer.conditions.some((condition) => condition.type !== "cart_total" && condition.type !== "payment_method");
		if (hasItemConditions) {
			const matchedItems = getMatchedCartItems(items, offer, context);
			if (matchedItems.length === 0) {
				continue;
			}
		} else if (!cartMatchesOffer(offer, context)) {
			continue;
		}

		const cartResult = applyCartWideOffer(offer, cartTotal, context, cartDiscounts);
		if (!cartResult.applied) {
			continue;
		}

		cartTotal = cartResult.cartTotal;
		totalDiscount += cartResult.totalDiscount;
		if (cartResult.freeShipping) {
			freeShipping = true;
		}
		appliedOfferIds.push(offer.id);
		if (!offer.allowLoyaltyPoints) {
			isLoyaltyPointsAllowed = false;
		}
		break;
	}

	return {
		itemDiscounts,
		cartDiscounts,
		totalDiscount,
		finalTotal: cartTotal,
		isLoyaltyPointsAllowed,
		freeShipping,
		appliedOfferIds,
	};
}

export function evaluateOffers(items: EvaluatableItem[], offers: ActiveOffer[], options: EvaluateOffersOptions = {}): OfferEvaluationResult {
	return evaluateCartOffers(items, offers, options);
}
