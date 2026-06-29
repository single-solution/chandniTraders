"use client";

import { ArrowUpRight, CheckCircle2, Package, Sparkles } from "lucide-react";
import { ButtonLink } from "@store/ui";
import { Card } from "@/components/ui/Card";
import { CHECKOUT_TO_ORDER_PAYMENT, LOYALTY_PROGRAM_NAME, formatPoints, isLoyaltyEarnCredited, type OrderPaymentMethod, type PaymentMethodId } from "@store/shared";
import { PaymentInstructionsCard } from "@/app/checkout/_components/PaymentInstructionsCard";

interface CheckoutSuccessProps {
	orderNumber: string;
	payment: PaymentMethodId | OrderPaymentMethod | null;
	totalRupees: number;
	pointsEarned: number;
	pointsRedeemed: number;
	orderStatus?: string;
}

export function CheckoutSuccess({ orderNumber, payment, totalRupees, pointsEarned, pointsRedeemed, orderStatus }: CheckoutSuccessProps) {
	const orderPayment =
		payment === "bank-transfer" || payment === "card" || payment === "cod"
			? CHECKOUT_TO_ORDER_PAYMENT[payment]
			: payment;
	const isCardConfirmed = orderPayment === "card" && orderStatus === "confirmed";
	const isCardPending = orderPayment === "card" && orderStatus === "pending-payment";
	const isBankTransferPending = orderPayment === "bank-transfer" && orderStatus === "pending-payment";
	const isCod = orderPayment === "cod";
	const isEarnCredited = isLoyaltyEarnCredited(orderStatus);

	return (
		<div className="storefront-page-center mx-auto max-w-3xl">
			<div className="w-full">
				<div className="reveal" style={{ ["--reveal-delay" as string]: "60ms" }}>
					<div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--color-success-50)] text-[var(--color-success-700)] md:size-20">
						<CheckCircle2 size={36} strokeWidth={2.2} className="animate-badge-pop" />
					</div>
				</div>
				<div className="reveal mt-5 text-center" style={{ ["--reveal-delay" as string]: "140ms" }}>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Order placed</p>
					<h1 className="mt-2 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">Thank you, your order is in.</h1>
					<p className="mt-2 text-[14px] text-[var(--color-ink-600)] md:text-[15px]">We&rsquo;ll send WhatsApp updates at every step. Save your order number below.</p>
				</div>

				<Card className="reveal mx-auto mt-6 max-w-xl overflow-hidden md:mt-8" style={{ ["--reveal-delay" as string]: "240ms" }}>
					<div className="flex items-center justify-between border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3 md:px-5 md:py-4">
						<div>
							<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Order number</p>
							<p className="mt-1 font-mono text-[16px] font-semibold tracking-tight text-[var(--color-ink-900)] md:text-[18px]">{orderNumber}</p>
						</div>
						<span className="grid size-10 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-800)]">
							<Package size={16} />
						</span>
					</div>
					<ul className="space-y-3 p-4 text-[13px] text-[var(--color-ink-700)] md:p-5">
						<li className="flex items-start gap-3">
							<span className="mt-1 size-1.5 rounded-full bg-[var(--color-accent-600)]" />
							<p>
								<strong className="text-[var(--color-ink-900)]">Within 2 hours</strong> —{" "}
								{isCardConfirmed || isCod
									? "we prep your order for final QC."
									: isBankTransferPending
										? "send your bank transfer screenshot on WhatsApp so we can confirm payment."
										: isCardPending
											? "complete card payment online to confirm your order."
											: "we prep your order for final QC."}
							</p>
						</li>
						<li className="flex items-start gap-3">
							<span className="mt-1 size-1.5 rounded-full bg-[var(--color-ink-300)]" />
							<p>
								<strong className="text-[var(--color-ink-900)]">Same day</strong> — we send proof of the packed item on request before dispatch.
							</p>
						</li>
						<li className="flex items-start gap-3">
							<span className="mt-1 size-1.5 rounded-full bg-[var(--color-ink-300)]" />
							<p>
								<strong className="text-[var(--color-ink-900)]">2–4 working days</strong> — tracked courier delivers door-to-door nationwide.
							</p>
						</li>
					</ul>
				</Card>

				{isCardConfirmed ? (
					<div className="reveal mx-auto mt-4 max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-4 text-[13px] text-[var(--color-success-900)] md:mt-6">
						Card payment received — your order is confirmed and moving to packing.
					</div>
				) : null}

				{isBankTransferPending ? (
					<div className="reveal mx-auto mt-4 max-w-xl md:mt-6" style={{ ["--reveal-delay" as string]: "280ms" }}>
						<PaymentInstructionsCard
							payment="bank-transfer"
							orderNumber={orderNumber}
							totalRupees={totalRupees}
							isPaymentComplete={false}
						/>
					</div>
				) : null}

				{isCardPending ? (
					<div className="reveal mx-auto mt-4 max-w-xl md:mt-6" style={{ ["--reveal-delay" as string]: "280ms" }}>
						<PaymentInstructionsCard
							payment="card"
							orderNumber={orderNumber}
							totalRupees={totalRupees}
							isPaymentComplete={false}
						/>
					</div>
				) : null}

				{isCod && totalRupees > 0 ? (
					<div className="reveal mx-auto mt-4 max-w-xl md:mt-6" style={{ ["--reveal-delay" as string]: "280ms" }}>
						<PaymentInstructionsCard payment={orderPayment} orderNumber={orderNumber} totalRupees={totalRupees} />
					</div>
				) : null}

				{(pointsEarned > 0 || pointsRedeemed > 0) && (
					<Card className="reveal mx-auto mt-4 max-w-xl overflow-hidden md:mt-6" style={{ ["--reveal-delay" as string]: "320ms" }}>
						<div className="flex items-center gap-3 bg-[var(--color-accent-50)] px-4 py-3 md:px-5">
							<span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
								<Sparkles size={16} strokeWidth={2.4} className="animate-badge-pop" />
							</span>
							<div className="min-w-0 flex-1">
								<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-700)]">{LOYALTY_PROGRAM_NAME}</p>
								{pointsEarned > 0 && (
									<p className="text-[14px] font-semibold text-[var(--color-ink-900)] md:text-[15px]">
										{isEarnCredited ? "You earned" : "You&rsquo;ll earn"}{" "}
										<span className="text-[var(--color-accent-800)]">{formatPoints(pointsEarned)}</span>
										{!isEarnCredited ? " when delivered" : null}
										{pointsRedeemed > 0 ? (
											<>
												{" "}
												and used <span className="text-[var(--color-accent-800)]">{formatPoints(pointsRedeemed)}</span>
											</>
										) : null}
									</p>
								)}
								{pointsEarned === 0 && pointsRedeemed > 0 && (
									<p className="text-[14px] font-semibold text-[var(--color-ink-900)] md:text-[15px]">
										You used <span className="text-[var(--color-accent-800)]">{formatPoints(pointsRedeemed)}</span> on this order
									</p>
								)}
							</div>
						</div>
					</Card>
				)}

				<div className="reveal mt-5 flex flex-col gap-2 md:mt-6 md:flex-row md:justify-center" style={{ ["--reveal-delay" as string]: "340ms" }}>
					<ButtonLink
						href={`/account/orders/${encodeURIComponent(orderNumber)}`}
						variant="primary"
						size="md"
						className="cta-arrow"
						trailingIcon={<ArrowUpRight size={15} strokeWidth={2.4} />}
					>
						View order details
					</ButtonLink>
					<ButtonLink href="/" variant="outline" size="md">
						Keep shopping
					</ButtonLink>
				</div>
			</div>
		</div>
	);
}
