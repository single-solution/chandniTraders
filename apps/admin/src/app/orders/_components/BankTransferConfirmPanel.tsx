import { Building2 } from "lucide-react";
import { formatPrice } from "@store/shared";

interface BankTransferConfirmPanelProps {
	orderNumber: string;
	totalRupees: number;
	bankTransferDetails?: {
		bankName: string;
		bankAccountTitle: string;
		bankAccountNumber: string;
		bankIban: string;
	};
}

export function BankTransferConfirmPanel({ orderNumber, totalRupees, bankTransferDetails }: BankTransferConfirmPanelProps) {
	const hasDetails = Boolean(bankTransferDetails?.bankAccountNumber?.trim() || bankTransferDetails?.bankIban?.trim());

	return (
		<section className="rounded-[var(--radius-md)] border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-warn-100)] text-[var(--color-warn-800)]">
					<Building2 size={16} />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warn-800)]">Awaiting bank transfer</p>
					<p className="mt-1 text-sm font-semibold text-[var(--color-ink-900)]">
						{orderNumber} · {formatPrice(totalRupees)}
					</p>
					{hasDetails ? (
						<dl className="mt-3 space-y-1 text-[13px] text-[var(--color-ink-700)]">
							{bankTransferDetails?.bankName?.trim() ? (
								<div className="flex justify-between gap-3">
									<dt className="text-[var(--color-ink-500)]">Bank</dt>
									<dd className="font-medium text-[var(--color-ink-900)]">{bankTransferDetails.bankName.trim()}</dd>
								</div>
							) : null}
							{bankTransferDetails?.bankAccountTitle?.trim() ? (
								<div className="flex justify-between gap-3">
									<dt className="text-[var(--color-ink-500)]">Account title</dt>
									<dd className="font-medium text-[var(--color-ink-900)]">{bankTransferDetails.bankAccountTitle.trim()}</dd>
								</div>
							) : null}
							{bankTransferDetails?.bankAccountNumber?.trim() ? (
								<div className="flex justify-between gap-3">
									<dt className="text-[var(--color-ink-500)]">Account number</dt>
									<dd className="font-mono font-medium text-[var(--color-ink-900)]">{bankTransferDetails.bankAccountNumber.trim()}</dd>
								</div>
							) : null}
							{bankTransferDetails?.bankIban?.trim() ? (
								<div className="flex justify-between gap-3">
									<dt className="text-[var(--color-ink-500)]">IBAN</dt>
									<dd className="font-mono text-[12px] font-medium text-[var(--color-ink-900)]">{bankTransferDetails.bankIban.trim()}</dd>
								</div>
							) : null}
						</dl>
					) : (
						<p className="mt-2 text-[12.5px] text-[var(--color-warn-800)]">Bank account details are missing under Settings → Payments.</p>
					)}
					<p className="mt-3 text-[12px] text-[var(--color-ink-600)]">Confirm payment after the customer sends a WhatsApp screenshot, then move the order to Confirmed.</p>
				</div>
			</div>
		</section>
	);
}
