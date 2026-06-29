"use client";

import { Building2 } from "lucide-react";
import { formatPrice } from "@store/shared";

import { useStoreSettings } from "@/lib/core/storeSettingsContext";

export interface BankTransferPaymentGuideProps {
	totalRupees: number;
}

export function BankTransferPaymentGuide({ totalRupees }: BankTransferPaymentGuideProps) {
	const settings = useStoreSettings();
	const hasBankDetails = Boolean(settings.bankAccountNumber.trim() || settings.bankIban.trim());

	return (
		<div className="reveal mt-4 rounded-[var(--radius-lg)] border border-[var(--color-accent-200)] bg-gradient-to-br from-[var(--color-accent-50)] via-[var(--color-surface)] to-[var(--color-surface)] p-4 md:p-5">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-800)]">
					<Building2 size={16} strokeWidth={2.2} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-semibold text-[var(--color-ink-900)]">Bank transfer (lowest fees)</p>
					<p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-[var(--color-ink-600)]">
						After placing the order, transfer <strong className="font-semibold text-[var(--color-ink-900)]">{formatPrice(totalRupees)}</strong>{" "}
						then send your payment screenshot on WhatsApp so we can confirm.
					</p>
					{hasBankDetails ? (
						<ul className="mt-3 space-y-1 text-[12px] text-[var(--color-ink-700)]">
							{settings.bankName.trim() ? <li>Bank: {settings.bankName.trim()}</li> : null}
							{settings.bankAccountTitle.trim() ? <li>Account: {settings.bankAccountTitle.trim()}</li> : null}
							{settings.bankAccountNumber.trim() ? <li>Number: {settings.bankAccountNumber.trim()}</li> : null}
							{settings.bankIban.trim() ? <li>IBAN: {settings.bankIban.trim()}</li> : null}
						</ul>
					) : (
						<p className="mt-2 text-[12px] text-[var(--color-warn-800)]">Bank details will appear here once saved in Admin → Settings → Payments.</p>
					)}
				</div>
			</div>
		</div>
	);
}
