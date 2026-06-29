"use client";

import { useEffect, useMemo, useState } from "react";

import { evaluateCartOffers, type ActiveOffer, type EvaluatableItem, type OfferPaymentMethod } from "@store/shared";

import type { CartItem } from "@/lib/cart/types";
import { useCart } from "@/lib/cart/useCart";
import { buildCartLineOfferIds } from "@/lib/pricing/cartOfferPricing";
import { useActiveOffers } from "@/lib/pricing/useActiveOffers";

function buildEvaluatableItems(items: CartItem[]): EvaluatableItem[] {
	return items.map((item) => ({
		id: item.id,
		productId: item.productId,
		variantId: item.variantId,
		categorySlug: item.categorySlug,
		brandSlug: item.brandSlug,
		price: item.unitPriceRupees,
		quantity: item.quantity,
		attributes: item.attributes ?? {},
	}));
}

async function fetchLockedOffers(ids: string[]): Promise<ActiveOffer[]> {
	if (ids.length === 0) {
		return [];
	}
	const response = await fetch(`/api/offers/resolve?ids=${encodeURIComponent(ids.join(","))}`);
	if (!response.ok) {
		return [];
	}
	return (await response.json()) as ActiveOffer[];
}

export function useCartOfferPricing(paymentMethod?: OfferPaymentMethod) {
	const cart = useCart();
	const { offers, isLoading: isOffersLoading } = useActiveOffers();
	const [resolvedLockedOffers, setResolvedLockedOffers] = useState<ActiveOffer[]>([]);

	const missingLockedOfferIds = useMemo(() => {
		const lockedIds = cart.items
			.map((line) => line.appliedOffer?.id ?? line.appliedOfferId)
			.filter((offerId): offerId is string => typeof offerId === "string" && offerId.length > 0);
		return lockedIds.filter((offerId) => !offers.some((offer) => offer.id === offerId));
	}, [cart.items, offers]);

	const lockedCatalogOffers = useMemo(
		() => (missingLockedOfferIds.length === 0 ? [] : resolvedLockedOffers),
		[missingLockedOfferIds.length, resolvedLockedOffers],
	);
	const missingLockedOfferKey = missingLockedOfferIds.join(",");

	useEffect(() => {
		let active = true;
		if (missingLockedOfferIds.length === 0) {
			return () => {
				active = false;
			};
		}
		void fetchLockedOffers(missingLockedOfferIds).then((resolved) => {
			if (active) {
				setResolvedLockedOffers(resolved);
			}
		});
		return () => {
			active = false;
		};
	}, [missingLockedOfferKey, missingLockedOfferIds]);

	const evaluatableItems = useMemo(() => buildEvaluatableItems(cart.items), [cart.items]);

	const pricing = useMemo(
		() =>
			evaluateCartOffers(evaluatableItems, offers, {
				paymentMethod,
				lineOfferIds: buildCartLineOfferIds(cart.items),
				lockedCatalogOffers,
			}),
		[evaluatableItems, offers, paymentMethod, cart.items, lockedCatalogOffers],
	);

	const appliedOffers = useMemo(() => {
		const offerCatalog = new Map<string, ActiveOffer>();
		for (const offer of offers) {
			offerCatalog.set(offer.id, offer);
		}
		for (const offer of lockedCatalogOffers) {
			if (!offerCatalog.has(offer.id)) {
				offerCatalog.set(offer.id, offer);
			}
		}
		return pricing.appliedOfferIds
			.map((offerId) => offerCatalog.get(offerId))
			.filter((offer): offer is ActiveOffer => offer !== undefined);
	}, [offers, lockedCatalogOffers, pricing.appliedOfferIds]);

	return { offers, pricing, appliedOffers, isOffersLoading };
}
