import type { EvaluatableItem, ActiveOffer } from "./offerEvaluator";
import { computeLockedItemOfferDiscount, itemMatchesLockedItemOffer } from "./offerEvaluator";
import type { OfferMatchContext } from "./offerMatching";
import { isOfferEligible } from "./offerSchedule";
import { isCheckoutOnlyOffer } from "./offerMatching";
import { isCatalogDealOffer } from "./offerScope";

/** Catalog deal locked when the shopper adds a line to the cart. */
export interface CartAppliedOfferLock {
	id: string;
	title: string;
	lockedAt: string;
}

export function resolveCartLineOfferId(line: { appliedOffer?: CartAppliedOfferLock; appliedOfferId?: string }): string | undefined {
	const offerId = line.appliedOffer?.id ?? line.appliedOfferId;
	return typeof offerId === "string" && offerId.length > 0 ? offerId : undefined;
}

/** Server-side guard — submitted offer id must exist and match the line. */
export function validateSubmittedCatalogOfferLock(
	appliedOfferId: string,
	item: EvaluatableItem,
	offer: ActiveOffer | undefined,
	context: OfferMatchContext,
): string | null {
	if (!offer) {
		return "Applied offer not found.";
	}
	if (!isOfferEligible(offer)) {
		return "Applied offer is no longer available.";
	}
	if (isCheckoutOnlyOffer(offer) || !isCatalogDealOffer(offer)) {
		return "Applied offer is not valid for this product.";
	}
	if (!itemMatchesLockedItemOffer(item, offer, context, { honorLock: true })) {
		return "Applied offer does not match this product.";
	}
	return null;
}

export function computeHonoredLockedItemDiscount(
	item: EvaluatableItem,
	offer: ActiveOffer,
	context: OfferMatchContext,
): number {
	return computeLockedItemOfferDiscount(item, offer, context, { honorLock: true });
}
