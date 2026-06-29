"use client";

import { useState } from "react";
import { CreditCard, Loader2, MessageCircle } from "lucide-react";
import {
	buildPaymentInstructions,
	buildWhatsAppLink,
	CHECKOUT_TO_ORDER_PAYMENT,
	formatPrice,
	type OrderPaymentMethod,
	type PaymentMethodId,
} from "@store/shared";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { Card } from "@/components/ui/Card";
import { launchOnlineCheckout, type OnlineCheckoutApiPayload } from "@/lib/payments/launchOnlineCheckout";

interface PaymentInstructionsCardProps {
	payment: OrderPaymentMethod | PaymentMethodId;
	orderNumber: string;
	totalRupees: number;
	isPaymentComplete?: boolean;
}

function resolveOrderPayment(payment: OrderPaymentMethod | PaymentMethodId): OrderPaymentMethod {
	if (payment === "bank-transfer" || payment === "card" || payment === "cod") {
		return CHECKOUT_TO_ORDER_PAYMENT[payment];
	}
	return payment;
}

export function PaymentInstructionsCard({ payment, orderNumber, totalRupees, isPaymentComplete = true }: PaymentInstructionsCardProps) {
	const settings = useStoreSettings();
	const orderPayment = resolveOrderPayment(payment);
	const isCardPending = orderPayment === "card" && !isPaymentComplete;
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);

	const copy = buildPaymentInstructions({
		payment: orderPayment,
		orderNumber,
		totalRupees,
		supportPhone: settings.supportPhone,
		bankTransfer: {
			bankName: settings.bankName,
			accountTitle: settings.bankAccountTitle,
			accountNumber: settings.bankAccountNumber,
			iban: settings.bankIban,
		},
		isPaymentComplete,
	});

	async function handlePayOnline() {
		if (isStartingCheckout) {
			return;
		}

		setIsStartingCheckout(true);
		setCheckoutError(null);

		try {
			const response = await fetch("/api/payments/checkout/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ orderNumber }),
			});
			const data = (await response.json()) as OnlineCheckoutApiPayload & { error?: string };

			if (!response.ok || (!data.checkoutUrl && !data.checkoutForm)) {
				setCheckoutError(data.error || "Could not start online payment. Please try again.");
				setIsStartingCheckout(false);
				return;
			}

			launchOnlineCheckout(data);
		} catch {
			setCheckoutError("Could not start online payment. Please try again.");
			setIsStartingCheckout(false);
		}
	}

	return (
		<Card className="overflow-hidden">
			<div
				className={
					isCardPending
						? "border-b border-[var(--color-ink-100)] bg-[var(--color-warn-50)] px-4 py-3 md:px-5"
						: orderPayment === "bank-transfer" && !isPaymentComplete
							? "border-b border-[var(--color-ink-100)] bg-[var(--color-warn-50)] px-4 py-3 md:px-5"
							: "border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3 md:px-5"
				}
			>
				<p
					className={
						isCardPending || (orderPayment === "bank-transfer" && !isPaymentComplete)
							? "text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warn-800)]"
							: "text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]"
					}
				>
					{isCardPending || (orderPayment === "bank-transfer" && !isPaymentComplete) ? "Payment required" : "Next step"}
				</p>
				<p className="mt-1 text-[15px] font-semibold text-[var(--color-ink-900)]">{copy.title}</p>
			</div>
			<ol className="list-decimal space-y-2.5 p-4 pl-8 text-[13px] leading-snug text-[var(--color-ink-700)] md:p-5 md:pl-9">
				{copy.steps.map((step) => (
					<li key={step} className="max-w-prose">
						{step}
					</li>
				))}
			</ol>
			<div className="space-y-2 border-t border-[var(--color-ink-100)] p-4 md:p-5">
				{isCardPending ? (
					<>
						<button
							type="button"
							onClick={handlePayOnline}
							disabled={isStartingCheckout}
							className="tap inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-600)] py-2.5 text-[13px] font-semibold text-[var(--color-on-dark)] hover:bg-[var(--color-accent-700)] disabled:opacity-70"
						>
							{isStartingCheckout ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
							{isStartingCheckout ? "Redirecting to payment…" : `Pay ${formatPrice(totalRupees)} online`}
						</button>
						{checkoutError ? <p className="text-center text-[12px] text-[var(--color-danger-700)]">{checkoutError}</p> : null}
					</>
				) : (
					<a
						href={buildWhatsAppLink(copy.whatsappPrefill, settings.whatsappNumber)}
						target="_blank"
						rel="noopener noreferrer"
						className="tap inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-whatsapp)] py-2.5 text-[13px] font-semibold text-[var(--color-on-dark)] hover:bg-[var(--color-whatsapp-dark)]"
					>
						<MessageCircle size={15} />
						Message us on WhatsApp
					</a>
				)}
			</div>
		</Card>
	);
}
