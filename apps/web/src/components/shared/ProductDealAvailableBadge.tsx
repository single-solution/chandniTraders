"use client";

import { Star } from "lucide-react";

interface ProductDealAvailableBadgeProps {
	offerCount: number;
}

/** Storefront hint that deals apply to this product — matches hero deal CTA colors. */
export function ProductDealAvailableBadge({ offerCount }: ProductDealAvailableBadgeProps) {
	if (offerCount <= 0) {
		return null;
	}

	const label = offerCount === 1 ? "1 offer" : `${offerCount} offers`;

	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent-400)] bg-[var(--color-accent-500)] px-2 py-1 text-[10px] font-bold leading-none text-[var(--color-ink-900)] shadow-[0_6px_18px_-12px_color-mix(in_srgb,var(--color-accent-500)_70%,transparent)] md:px-2.5 md:py-1 md:text-[11px]">
			<Star size={10} aria-hidden className="shrink-0 fill-current" />
			{label}
		</span>
	);
}
