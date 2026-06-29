import { DEAL_NOTICES_LAYOUT_CLASS, DEAL_NOTICE_CHIP_CLASS, DealNoticeChipContent } from "@/app/_components/shop/dealOfferButtonStyles";
import type { Offer } from "@store/shared";

interface StorefrontOfferNoticesProps {
	offers: Offer[];
}

export function StorefrontOfferNotices({ offers }: StorefrontOfferNoticesProps) {
	if (offers.length === 0) {
		return null;
	}

	return (
		<div className={DEAL_NOTICES_LAYOUT_CLASS} role="list" aria-label="Checkout offers">
			{offers.map((offer) => (
				<div key={offer.id} role="listitem" className={DEAL_NOTICE_CHIP_CLASS}>
					<DealNoticeChipContent badgeLabel={offer.badgeLabel} discountLabel={offer.discountLabel} title={offer.title} />
				</div>
			))}
		</div>
	);
}
