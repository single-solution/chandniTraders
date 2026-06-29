"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

import { DealOfferButtonLink } from "@/app/_components/shop/DealOfferButton";
import { DEAL_BUTTONS_LAYOUT_CLASS, HeroDealBadge, PRIMARY_DEAL_BUTTON_CLASS, SECONDARY_DEAL_BUTTON_CLASS } from "@/app/_components/shop/dealOfferButtonStyles";
import { classNames, type Offer } from "@store/shared";

interface ShopHeroDealsCtaProps {
	offers: Offer[];
}

function MoreDealsLink({ count }: { count: number }) {
	const label = count === 1 ? "+ 1 more" : `+ ${count} more`;

	return (
		<Link href="/deals" className={classNames(SECONDARY_DEAL_BUTTON_CLASS, "items-center justify-center gap-1 md:inline-flex")}>
			<span className="text-[12px] font-bold leading-tight md:text-[13px]">{label}</span>
			<ArrowUpRight size={14} strokeWidth={2.4} aria-hidden className="shrink-0 md:h-[15px] md:w-[15px]" />
		</Link>
	);
}

function SingleDealLink({ offer }: { offer: Offer }) {
	return (
		<Link href={`/deals#${offer.slug}`} className={classNames(PRIMARY_DEAL_BUTTON_CLASS, "col-span-2 md:col-span-1")}>
			<span className="flex min-w-0 items-center justify-between gap-1 md:contents">
				<span className="text-[12px] font-bold leading-tight md:text-[14px]">Today&apos;s deals</span>
				<span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold md:order-last md:gap-1 md:text-xs">
					View
					<ArrowUpRight size={14} strokeWidth={2.4} aria-hidden className="md:h-[15px] md:w-[15px]" />
				</span>
			</span>
			<HeroDealBadge label={offer.badgeLabel} />
			<span className="text-[13px] font-extrabold leading-none text-[var(--color-accent-700)] md:text-sm">{offer.discountLabel}</span>
			<span className="line-clamp-2 text-[11px] font-medium leading-snug text-[var(--color-ink-800)] md:line-clamp-none md:text-[13px] md:text-center">
				{offer.title}
			</span>
		</Link>
	);
}

/** Animated deals row under the catalog hero headline when live offers exist. */
export function ShopHeroDealsCta({ offers }: ShopHeroDealsCtaProps) {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsVisible(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);

	if (offers.length === 0) {
		return null;
	}

	const isMultiple = offers.length > 1;
	const latestOffer = offers[0];

	return (
		<div
			className={classNames(
				"grid w-full transition-[grid-template-rows,opacity,margin-top] duration-[460ms] ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
				isVisible ? "mt-[18px] grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
			)}
		>
			<div className="overflow-hidden">
				<div className={classNames(DEAL_BUTTONS_LAYOUT_CLASS, "overflow-hidden px-0.5")}>
					{isMultiple && latestOffer ? (
						<>
							<DealOfferButtonLink offer={latestOffer} href={`/deals#${latestOffer.slug}`} />
							<MoreDealsLink count={offers.length - 1} />
						</>
					) : latestOffer ? (
						<SingleDealLink offer={latestOffer} />
					) : null}
				</div>
			</div>
		</div>
	);
}
