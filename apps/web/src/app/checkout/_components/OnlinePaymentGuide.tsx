"use client";

import { CreditCard, Lock } from "lucide-react";
import { formatPrice } from "@store/shared";

interface OnlinePaymentGuideProps {
	totalRupees: number;
	isPlacing: boolean;
}

export function OnlinePaymentGuide({ totalRupees, isPlacing }: OnlinePaymentGuideProps) {
	const totalLabel = formatPrice(totalRupees);

	return (
		<div className="reveal mt-4 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-accent-200)] bg-gradient-to-br from-[var(--color-accent-50)] via-[var(--color-surface)] to-[var(--color-surface)] p-4 md:p-5">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-800)]">
					<Lock size={16} strokeWidth={2.2} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-semibold text-[var(--color-ink-900)]">Pay online (Pakistan gateway)</p>
					<p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-[var(--color-ink-600)]">
						After you place the order, you&rsquo;ll pay {totalLabel} on PayFast or Rapid Gateway — cards, JazzCash, easypaisa, and Raast when enabled in Admin.
						Bank transfer usually has the lowest fees.
					</p>
				</div>
			</div>
			<ol className="list-decimal space-y-2 pl-5 text-[12.5px] leading-snug text-[var(--color-ink-700)]">
				<li>Place your order — we reserve stock for you.</li>
				<li>Complete payment on the secure gateway page.</li>
				<li>We confirm automatically and start packing.</li>
			</ol>
			<p className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-500)]">
				<CreditCard size={12} />
				{isPlacing ? "Starting secure checkout…" : "Configure PayFast or Rapid Gateway under Admin → Settings → Integrations."}
			</p>
		</div>
	);
}
