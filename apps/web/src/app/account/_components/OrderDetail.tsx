"use client";

import Link from "next/link";
import {
	buildWhatsAppLink,
	classNames,
	formatPoints,
	formatPrice,
	formatStorefrontDate,
	formatStorefrontDateTime,
	getPaymentMethodLabel,
	isLoyaltyEarnCredited,
	LOYALTY_PROGRAM_NAME,
	orderPaymentToCheckoutId,
} from "@store/shared";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";
import { PaymentInstructionsCard } from "@/app/checkout/_components/PaymentInstructionsCard";
import { OrderCancelAction } from "@/app/account/_components/OrderCancelAction";
import { ArrowLeft, Building2, CalendarClock, Check, CreditCard, Headset, MapPin, MessageCircle, Package, Phone, Sparkles, Store, Truck, Banknote } from "lucide-react";
import { Card } from "@/components/ui/Card";

import type { Order, OrderTimelineEntry } from "@/lib/core/orderSerializer";
import type { OrderStatus } from "@store/db";

const TONE: Record<OrderStatus, { toneBg: string; toneFg: string; toneDot: string; nextLabel?: string }> = {
	"pending-payment": {
		toneBg: "bg-[var(--color-warn-50)]",
		toneFg: "text-[var(--color-warn-800)]",
		toneDot: "bg-[var(--color-warn-500)]",
		nextLabel: "Awaiting payment",
	},
	confirmed: {
		toneBg: "bg-[var(--color-info-50)]",
		toneFg: "text-[var(--color-info-800)]",
		toneDot: "bg-[var(--color-info-500)]",
		nextLabel: "Packing",
	},
	dispatched: {
		toneBg: "bg-[var(--color-accent-100)]",
		toneFg: "text-[var(--color-accent-800)]",
		toneDot: "bg-[var(--color-accent-600)]",
		nextLabel: "On the way",
	},
	packed: {
		toneBg: "bg-[var(--color-accent-100)]",
		toneFg: "text-[var(--color-accent-800)]",
		toneDot: "bg-[var(--color-accent-600)]",
		nextLabel: "Dispatching soon",
	},
	returned: {
		toneBg: "bg-[var(--color-warn-50)]",
		toneFg: "text-[var(--color-warn-800)]",
		toneDot: "bg-[var(--color-warn-500)]",
	},
	delivered: {
		toneBg: "bg-[var(--color-success-50)]",
		toneFg: "text-[var(--color-success-800)]",
		toneDot: "bg-[var(--color-success-500)]",
	},
	cancelled: {
		toneBg: "bg-[var(--color-danger-50)]",
		toneFg: "text-[var(--color-danger-800)]",
		toneDot: "bg-[var(--color-danger-500)]",
	},
	refunded: {
		toneBg: "bg-[var(--color-danger-50)]",
		toneFg: "text-[var(--color-danger-800)]",
		toneDot: "bg-[var(--color-danger-500)]",
	},
};

interface OrderDetailProps {
	order: Order;
}

export function OrderDetail({ order }: OrderDetailProps) {
	const tone = TONE[order.status];
	const isCancelled = order.status === "cancelled" || order.status === "refunded";
	const pendingNextLabel =
		order.status === "pending-payment" && order.payment === "card"
			? "Complete online payment"
			: order.status === "pending-payment" && order.payment === "bank-transfer"
				? "Send payment screenshot"
				: tone.nextLabel;
	// Use the static label (not the filtered live list) so an order placed
	// before an admin disabled a payment method still renders correctly.
	const paymentLabel = getPaymentMethodLabel(orderPaymentToCheckoutId(order.payment) ?? order.payment);

	return (
		<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-4 md:pb-16 md:pt-10`}>
			<Link href="/account#orders" className="cta-arrow tap inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]">
				<ArrowLeft size={13} />
				All orders
			</Link>

			<div className="reveal mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Order</p>
					<h1 className="mt-1 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">{order.orderNumber}</h1>
					<p className="mt-1 text-[13px] text-[var(--color-ink-500)] md:text-sm">
						Placed on {formatStorefrontDate(order.placedAt)} · {order.delivery === "pickup" ? "Pickup at our store" : "Door delivery"}
					</p>
				</div>
				<span className={classNames("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold", tone.toneBg, tone.toneFg)}>
					<span className={classNames("size-1.5 rounded-full", tone.toneDot)} />
					{order.statusLabel}
					{tone.nextLabel && <span className="hidden font-medium text-[var(--color-ink-500)] md:inline">· {pendingNextLabel}</span>}
				</span>
			</div>

			<div className="mt-5 grid gap-4 md:mt-8 md:grid-cols-[1fr_360px] md:gap-6 lg:gap-8">
				<div className="reveal-stagger space-y-4">
					{order.status === "pending-payment" && (order.payment === "card" || order.payment === "bank-transfer") ? (
						<div className="reveal">
							<PaymentInstructionsCard
								payment={order.payment}
								orderNumber={order.orderNumber}
								totalRupees={order.totals.totalRupees}
								isPaymentComplete={false}
							/>
						</div>
					) : null}
					{!isCancelled && order.timeline.length > 0 && (
						<div className="reveal">
							<StatusTimelinePanel order={order} />
						</div>
					)}
					<div className="reveal">
						<ItemsCard order={order} />
					</div>
					<div className="reveal">
						<SupportCard orderNumber={order.orderNumber} />
					</div>
					{!isCancelled ? (
						<div className="reveal">
							<OrderCancelAction orderNumber={order.orderNumber} status={order.status} />
						</div>
					) : null}
				</div>

				<aside className="reveal-stagger space-y-4 md:sticky md:top-[calc(var(--desktop-header-h)+24px)] md:self-start">
					<div className="reveal">
						<SummaryCard order={order} paymentLabel={paymentLabel} />
					</div>
					{order.address && order.delivery === "courier" ? (
						<div className="reveal">
							<AddressCard address={order.address} />
						</div>
					) : order.delivery === "pickup" ? (
						<div className="reveal">
							<PickupCard />
						</div>
					) : null}
				</aside>
			</div>
		</div>
	);
}

function StatusTimelinePanel({ order }: { order: Order }) {
	return (
		<Card className="overflow-hidden">
			<p className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] md:px-5">
				Timeline
			</p>
			<ol className="space-y-4 p-4 md:p-5">
				{order.timeline.map((entry, index) => (
					<TimelineRow
						key={`${entry.status}-${index}`}
						entry={entry}
						isLast={index === order.timeline.length - 1}
						isCurrent={index === order.timeline.length - 1 && order.status !== "delivered"}
					/>
				))}
			</ol>
			{order.estimatedDeliveryAt && (
				<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/40 p-3 px-4 text-[12.5px] text-[var(--color-ink-600)] md:px-5">
					<CalendarClock size={13} className="mr-1 inline-block align-text-bottom" />
					Estimated delivery {formatStorefrontDate(order.estimatedDeliveryAt)}
				</div>
			)}
		</Card>
	);
}

function TimelineRow({ entry, isLast, isCurrent }: { entry: OrderTimelineEntry; isLast: boolean; isCurrent: boolean }) {
	return (
		<li className="relative flex gap-3 pl-1">
			{!isLast && <span aria-hidden className="absolute left-[10px] top-6 bottom-[-12px] w-px bg-[var(--color-accent-300)]" />}
			<span
				className={classNames(
					"z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
					"border-[var(--color-accent-500)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]",
					isCurrent && "border-[var(--color-accent-500)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)]",
				)}
			>
				<Check size={10} strokeWidth={3.2} />
			</span>
			<div className="min-w-0 flex-1 pb-1">
				<div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
					<p className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">{entry.label}</p>
					<p className="text-[11px] text-[var(--color-ink-500)]">{formatStorefrontDateTime(entry.occurredAt)}</p>
				</div>
				{entry.description && <p className="mt-0.5 max-w-prose text-[12.5px] leading-snug text-[var(--color-ink-600)]">{entry.description}</p>}
			</div>
		</li>
	);
}

function ItemsCard({ order }: { order: Order }) {
	return (
		<Card className="overflow-hidden">
			<p className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] md:px-5">
				Items in this order
			</p>
			<ul className="divide-y divide-[var(--color-ink-100)]">
				{order.items.map((line) => (
					<li key={line.id} className="flex items-center gap-3 p-4 md:p-5">
						<span className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-500)]">
							<Package size={18} />
						</span>
						<div className="min-w-0 flex-1">
							<p className="line-clamp-1 text-[14px] font-semibold text-[var(--color-ink-900)]">{line.productName}</p>
							<p className="text-[12px] text-[var(--color-ink-500)]">{line.variantSummary}</p>
						</div>
						<div className="text-right">
							<p className="text-[13.5px] font-semibold tabular-nums text-[var(--color-ink-900)]">{formatPrice(line.unitPriceRupees * line.quantity)}</p>
							<p className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ink-400)]">Qty {line.quantity}</p>
						</div>
					</li>
				))}
			</ul>
		</Card>
	);
}

function SupportCard({ orderNumber }: { orderNumber: string }) {
	const { supportPhone, whatsappNumber } = useStoreSettings();
	return (
		<Card className="p-4 md:p-5">
			<div className="flex items-center gap-2">
				<span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-100)] text-[var(--color-accent-700)]">
					<Headset size={14} />
				</span>
				<p className="text-[13px] font-semibold text-[var(--color-ink-900)]">Need a hand with this order?</p>
			</div>
			<p className="mt-2 max-w-prose text-[12.5px] text-[var(--color-ink-500)]">We reply on WhatsApp within minutes — every working day until 9 PM.</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<a
					href={buildWhatsAppLink(`Salam! Order ${orderNumber}.`, whatsappNumber)}
					target="_blank"
					rel="noopener noreferrer"
					className="tap inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-whatsapp)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-on-dark)] hover:bg-[var(--color-whatsapp-dark)]"
				>
					<MessageCircle size={13} />
					WhatsApp
				</a>
				<a
					href={`tel:${supportPhone.replace(/\s+/g, "")}`}
					className="tap inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-ink-800)]"
				>
					<Phone size={13} />
					Call
				</a>
			</div>
		</Card>
	);
}

function SummaryCard({ order, paymentLabel }: { order: Order; paymentLabel?: string }) {
	const PaymentIcon = order.payment === "cod" ? Banknote : order.payment === "bank-transfer" ? Building2 : CreditCard;
	const paymentLine =
		order.payment === "cod"
			? `Cash on delivery — pay ${formatPrice(order.totals.totalRupees)} when you receive it`
			: order.payment === "bank-transfer" && order.status === "pending-payment"
				? "Bank transfer — send payment screenshot on WhatsApp"
				: order.payment === "bank-transfer"
					? "Paid by bank transfer"
					: order.status === "pending-payment"
						? "Card payment pending"
						: paymentLabel
							? `Paid by ${paymentLabel.toLowerCase()}`
							: null;

	return (
		<Card className="overflow-hidden">
			<p className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] md:px-5">
				Summary
			</p>
			<dl className="space-y-2 p-4 text-[13px] md:p-5">
				<Row label="Subtotal" value={formatPrice(order.totals.subtotalRupees)} />
				<Row label="Delivery" value={order.totals.shippingRupees > 0 ? formatPrice(order.totals.shippingRupees) : "Free"} />
				{order.totals.discountRupees > 0 && <Row label="Discount" value={`− ${formatPrice(order.totals.discountRupees)}`} />}
				{order.totals.paymentSurchargeRupees > 0 && (
					<Row label="Cash handling" value={`+ ${formatPrice(order.totals.paymentSurchargeRupees)}`} />
				)}
				<div className="border-t border-[var(--color-ink-100)] pt-2">
					<Row label="Total" value={formatPrice(order.totals.totalRupees)} valueClassName="text-[15px] font-semibold text-[var(--color-ink-900)]" />
				</div>
				{paymentLine ? (
					<div className="flex items-center gap-2 pt-2 text-[12px] text-[var(--color-ink-600)]">
						<PaymentIcon size={13} className="text-[var(--color-ink-400)]" />
						{paymentLine}
					</div>
				) : null}
				{(order.pointsEarned > 0 || order.pointsRedeemed > 0) && (
					<div className="mt-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-50)] px-3 py-2 text-[12px] text-[var(--color-accent-800)]">
						<Sparkles size={13} />
						{order.pointsEarned > 0 && (
							<span>
								<span className="font-semibold">{formatPoints(order.pointsEarned)}</span> {LOYALTY_PROGRAM_NAME.toLowerCase()}{" "}
								{isLoyaltyEarnCredited(order.status) ? "earned" : "when delivered"}
							</span>
						)}
						{order.pointsRedeemed > 0 && <span>· {formatPoints(order.pointsRedeemed)} redeemed</span>}
					</div>
				)}
			</dl>
		</Card>
	);
}

function Row({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
	return (
		<div className="flex items-center justify-between">
			<dt className="text-[var(--color-ink-500)]">{label}</dt>
			<dd className={classNames("tabular-nums text-[var(--color-ink-800)]", valueClassName)}>{value}</dd>
		</div>
	);
}

function AddressCard({ address }: { address: NonNullable<Order["address"]> }) {
	return (
		<Card className="p-4 md:p-5">
			<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Delivering to</p>
			<div className="mt-2 flex items-start gap-2">
				<Truck size={14} className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" />
				<p className="text-[13px] leading-snug text-[var(--color-ink-800)]">
					<span className="font-semibold text-[var(--color-ink-900)]">{address.recipientName}</span>
					<br />
					{[address.street, address.area].filter(Boolean).join(", ")}
					<br />
					{address.city}
					{address.postalCode ? `, ${address.postalCode}` : ""}
					<br />
					<span className="text-[var(--color-ink-500)]">{address.phoneNumber}</span>
				</p>
			</div>
		</Card>
	);
}

function PickupCard() {
	const { storeAddressLine1, storeHours } = useStoreSettings();
	return (
		<Card className="p-4 md:p-5">
			<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Pickup at the store</p>
			<div className="mt-2 flex items-start gap-2">
				<Store size={14} className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" />
				<p className="text-[13px] leading-snug text-[var(--color-ink-800)]">
					<span className="font-semibold text-[var(--color-ink-900)]">{storeAddressLine1}</span>
					<br />
					<span className="text-[var(--color-ink-500)]">
						<MapPin size={11} className="mr-0.5 inline-block align-text-bottom" />
						{storeHours}
					</span>
				</p>
			</div>
		</Card>
	);
}
