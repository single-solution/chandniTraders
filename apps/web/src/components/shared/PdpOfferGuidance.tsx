"use client";

import { Check } from "lucide-react";

import { classNames, formatOfferDiscountLabel, type ActiveOffer, type AttributeDescriptor, type Product } from "@store/shared";

import {
	PDP_INFO_OFFER_PILL_APPLIED_CLASS,
	PDP_INFO_OFFER_PILL_CLASS,
	HeroDealBadge,
} from "@/app/_components/shop/dealOfferButtonStyles";
import {
	summarizePdpOfferRequirementsInline,
	type PdpOfferRequirementsContext,
} from "@/lib/pricing/describePdpOfferRequirements";

interface PdpOfferGuidanceProps {
	offers: ActiveOffer[];
	appliedOfferId: string | null;
	product: Product;
	brandName: string;
	categoryAttributes: AttributeDescriptor[];
	categoryLabelsBySlug: Record<string, string>;
}

export function PdpOfferGuidance({
	offers,
	appliedOfferId,
	product,
	brandName,
	categoryAttributes,
	categoryLabelsBySlug,
}: PdpOfferGuidanceProps) {
	if (offers.length === 0) {
		return null;
	}

	const requirementsContext: PdpOfferRequirementsContext = {
		product,
		brandName,
		categoryAttributes,
		categoryLabelsBySlug,
	};

	return (
		<div className="space-y-2" aria-label="Offer details">
			{offers.map((offer) => {
				const isApplied = offer.id === appliedOfferId;
				const requirementsInline = summarizePdpOfferRequirementsInline(offer, requirementsContext);
				const discountLabel = formatOfferDiscountLabel(offer.action);
				const badgeLabel = offer.badgeLabel?.trim() || "Deal";

				return (
					<article
						key={offer.id}
						className={classNames(PDP_INFO_OFFER_PILL_CLASS, isApplied && PDP_INFO_OFFER_PILL_APPLIED_CLASS)}
					>
						<span className="flex min-w-0 items-center justify-between gap-1 md:contents">
							<HeroDealBadge label={badgeLabel} />
							{isApplied ? (
								<span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[var(--color-accent-800)] md:order-last md:gap-1 md:text-xs">
									<Check size={13} strokeWidth={2.6} aria-hidden className="md:h-3.5 md:w-3.5" />
									<span className="hidden md:inline">Applied</span>
									<span className="md:hidden">On</span>
								</span>
							) : null}
						</span>

						<span className="flex min-w-0 flex-1 flex-col gap-0.5 md:contents">
							<span className="text-[13px] font-extrabold leading-none text-[var(--color-accent-800)] md:text-sm">{discountLabel}</span>
							<span className="line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--color-ink-900)] md:line-clamp-none md:text-[13px] md:text-center">
								{offer.title}
							</span>
							{requirementsInline ? (
								<span className="line-clamp-3 text-[10px] font-medium leading-snug text-[var(--color-ink-600)] md:line-clamp-none md:max-w-[22rem] md:text-[11px] md:text-center">
									{requirementsInline}
								</span>
							) : null}
						</span>
					</article>
				);
			})}
		</div>
	);
}
