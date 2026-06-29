"use client";

import { Banknote } from "lucide-react";
import { formatPrice } from "@store/shared";

export interface CodPaymentGuideProps {
	totalRupees: number;
	surchargeRupees: number;
}

export function CodPaymentGuide({ totalRupees, surchargeRupees }: CodPaymentGuideProps) {
	return (
		<div className="reveal mt-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/40 p-4 md:p-5">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-ink-700)] shadow-[var(--shadow-sm)]">
					<Banknote size={16} strokeWidth={2.2} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-semibold text-[var(--color-ink-900)]">Cash on delivery / pickup</p>
					<p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-[var(--color-ink-600)]">
						Keep <strong className="font-semibold text-[var(--color-ink-900)]">{formatPrice(totalRupees)}</strong> ready
						{surchargeRupees > 0 ? ` (includes ${formatPrice(surchargeRupees)} cash handling)` : ""}. Our team confirms the exact amount before dispatch.
					</p>
					<p className="mt-2 text-[12px] text-[var(--color-ink-500)]">Pay in cash when you receive the parcel or collect from our store.</p>
				</div>
			</div>
		</div>
	);
}
