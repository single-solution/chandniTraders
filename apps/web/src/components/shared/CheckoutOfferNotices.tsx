"use client";

import { Check } from "lucide-react";

import {
	DEAL_NOTICES_LAYOUT_CLASS,
	DEAL_NOTICE_CHIP_APPLIED_CLASS,
	DEAL_NOTICE_CHIP_CLASS,
	DealNoticeChipContent,
} from "@/app/_components/shop/dealOfferButtonStyles";
import { classNames, formatOfferDiscountLabel, isCatalogDealOffer, type ActiveOffer } from "@store/shared";

interface CheckoutOfferNoticesProps {
	appliedOffers: ActiveOffer[];
	className?: string;
}

export function CheckoutOfferNotices({ appliedOffers, className }: CheckoutOfferNoticesProps) {
	if (appliedOffers.length === 0) {
		return null;
	}

	return (
		<div className={classNames(DEAL_NOTICES_LAYOUT_CLASS, className)} role="list" aria-label="Applied offers">
			{appliedOffers.map((offer) => (
				<div key={offer.id} role="listitem" className={classNames(DEAL_NOTICE_CHIP_CLASS, DEAL_NOTICE_CHIP_APPLIED_CLASS)}>
					<DealNoticeChipContent
						badgeLabel={offer.badgeLabel?.trim() || (isCatalogDealOffer(offer) ? "Deal" : "Offer")}
						discountLabel={formatOfferDiscountLabel(offer.action)}
						title={offer.title}
					/>
					<span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[var(--color-accent-800)] md:gap-1 md:text-[11px]">
						<Check size={13} strokeWidth={2.6} aria-hidden />
						Applied
					</span>
				</div>
			))}
		</div>
	);
}
