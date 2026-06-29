import { Check } from "lucide-react";

import type { DiscountApplication } from "@store/shared";
import { formatPrice } from "@store/shared";

interface CartLinePriceProps {
	lineTotalRupees: number;
	discounts?: DiscountApplication[];
	lockedOfferTitle?: string;
}

export function CartLinePrice({ lineTotalRupees, discounts = [], lockedOfferTitle }: CartLinePriceProps) {
	const totalDiscountAmount = discounts.reduce((sum, discount) => sum + discount.discountAmount, 0);
	const finalLineTotal = lineTotalRupees - totalDiscountAmount;
	const hasDiscount = discounts.length > 0 && totalDiscountAmount > 0;
	const offerLabels = hasDiscount
		? discounts.map((discount) => discount.offerTitle)
		: lockedOfferTitle
			? [lockedOfferTitle]
			: [];

	return (
		<div className="flex flex-col items-end gap-0.5">
			{hasDiscount ? <p className="text-[12px] font-medium text-[var(--color-ink-500)] line-through">{formatPrice(lineTotalRupees)}</p> : null}
			<p className="text-[15px] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink-900)] md:text-[16px]">{formatPrice(finalLineTotal)}</p>
			{offerLabels.length > 0 ? (
				<div className="mt-1 flex flex-col items-end gap-0.5">
					{offerLabels.map((label) => (
						<span
							key={label}
							className="inline-flex items-center gap-0.5 rounded-sm bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent-800)]"
						>
							<Check size={10} strokeWidth={2.6} aria-hidden />
							{label}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
