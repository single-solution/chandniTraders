"use client";

import { useMemo } from "react";

import { type Product } from "@store/shared";

import { ProductDealAvailableBadge } from "@/components/shared/ProductDealAvailableBadge";
import { resolveProductCatalogDealOffers } from "@/lib/pricing/productOfferMatch";
import { useActiveOffers } from "@/lib/pricing/useActiveOffers";
import { isProductInStock } from "@/lib/productSummary";

/** Deal-available star on the PDP gallery — any in-stock variant on the product qualifies. */
export function PdpOfferBadgeOverlay({ product }: { product: Product }) {
	const { offers } = useActiveOffers();

	const applicableOfferCount = useMemo(() => {
		if (offers.length === 0 || !isProductInStock(product)) {
			return 0;
		}
		return resolveProductCatalogDealOffers(product, offers).length;
	}, [offers, product]);

	if (applicableOfferCount <= 0) {
		return null;
	}

	return (
		<div className="pointer-events-none absolute left-2 top-2 z-20 md:left-3 md:top-3">
			<ProductDealAvailableBadge offerCount={applicableOfferCount} />
		</div>
	);
}
