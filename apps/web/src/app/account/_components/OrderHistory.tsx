"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronRight, Package } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@store/ui";
import { classNames, formatPrice, formatStorefrontDate } from "@store/shared";
import type { Order } from "@/lib/core/orderSerializer";
import type { OrderStatus } from "@store/db";

type FilterId = "all" | "active" | "delivered" | "cancelled";

const ACTIVE_STATUSES: OrderStatus[] = ["pending-payment", "confirmed", "packed", "dispatched"];
const TONE: Record<OrderStatus, { toneBg: string; toneFg: string; toneDot: string; nextLabel?: string }> = {
	"pending-payment": { toneBg: "bg-[var(--color-warn-50)]", toneFg: "text-[var(--color-warn-800)]", toneDot: "bg-[var(--color-warn-500)]", nextLabel: "Awaiting payment" },
	confirmed: { toneBg: "bg-[var(--color-info-50)]", toneFg: "text-[var(--color-info-800)]", toneDot: "bg-[var(--color-info-500)]", nextLabel: "Packing" },
	dispatched: { toneBg: "bg-[var(--color-accent-100)]", toneFg: "text-[var(--color-accent-800)]", toneDot: "bg-[var(--color-accent-600)]", nextLabel: "On the way" },
	packed: { toneBg: "bg-[var(--color-accent-100)]", toneFg: "text-[var(--color-accent-800)]", toneDot: "bg-[var(--color-accent-600)]", nextLabel: "Dispatching soon" },
	returned: { toneBg: "bg-[var(--color-warn-50)]", toneFg: "text-[var(--color-warn-800)]", toneDot: "bg-[var(--color-warn-500)]" },
	delivered: { toneBg: "bg-[var(--color-success-50)]", toneFg: "text-[var(--color-success-800)]", toneDot: "bg-[var(--color-success-500)]" },
	cancelled: { toneBg: "bg-[var(--color-danger-50)]", toneFg: "text-[var(--color-danger-800)]", toneDot: "bg-[var(--color-danger-500)]" },
	refunded: { toneBg: "bg-[var(--color-danger-50)]", toneFg: "text-[var(--color-danger-800)]", toneDot: "bg-[var(--color-danger-500)]" },
};

const FILTERS: { id: FilterId; label: string; matches: (order: Order) => boolean }[] = [
	{ id: "all", label: "All", matches: () => true },
	{ id: "active", label: "Active", matches: (order) => ACTIVE_STATUSES.includes(order.status) },
	{ id: "delivered", label: "Delivered", matches: (order) => order.status === "delivered" },
	{ id: "cancelled", label: "Cancelled", matches: (order) => order.status === "cancelled" || order.status === "refunded" },
];

interface OrderHistoryProps {
	orders: Order[];
}

export function OrderHistory({ orders }: OrderHistoryProps) {
	const [filter, setFilter] = useState<FilterId>("all");

	const filtered = useMemo(() => {
		const filterDef = FILTERS.find((definition) => definition.id === filter);
		if (!filterDef) {
			return orders;
		}
		return orders.filter(filterDef.matches);
	}, [filter, orders]);

	const counts = useMemo(() => {
		return FILTERS.reduce<Record<FilterId, number>>(
			(totals, definition) => {
				totals[definition.id] = orders.filter(definition.matches).length;
				return totals;
			},
			{ all: 0, active: 0, delivered: 0, cancelled: 0 },
		);
	}, [orders]);

	return (
		<div id="orders" className="flex flex-col">
			<div className="reveal flex items-end justify-between gap-3">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">History</p>
					<h2 className="mt-1 text-[18px] font-semibold text-[var(--color-ink-900)] md:text-[22px]">Your orders</h2>
				</div>
				<p className="hidden text-[12px] font-medium text-[var(--color-ink-500)] md:block">{orders.length} total</p>
			</div>

			<div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 md:mt-5 [&::-webkit-scrollbar]:hidden">
				{FILTERS.map((definition) => {
					const isActive = definition.id === filter;
					const count = counts[definition.id];
					return (
						<button
							key={definition.id}
							type="button"
							onClick={() => setFilter(definition.id)}
							className={classNames(
								"tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
								isActive
									? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
									: "bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-canvas-deep)]",
							)}
						>
							{definition.label}
							<span
								className={classNames(
									"grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold",
									isActive ? "bg-[var(--color-accent-500)] text-[var(--color-ink-900)]" : "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]",
								)}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>

			<div className="cv-auto mt-5 md:mt-6">
				{filtered.length === 0 ? (
					<Empty filter={filter} onClearFilter={() => setFilter("all")} />
				) : (
					<ul className="reveal-scroll-list space-y-3">
						{filtered.map((order) => (
							<li key={order.id} className="reveal reveal-scroll reveal-rise">
								<OrderRow order={order} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

interface OrderRowProps {
	order: Order;
}

function OrderRow({ order }: OrderRowProps) {
	const tone = TONE[order.status];
	const nextLabel =
		order.status === "pending-payment" && order.payment === "card"
			? "Complete card payment"
			: order.status === "pending-payment" && order.payment === "bank-transfer"
				? "Send payment screenshot"
				: tone.nextLabel;
	const firstItem = order.items[0];
	const extraCount = Math.max(0, order.items.length - 1);

	return (
		<Link
			href={`/account/orders/${order.orderNumber}`}
			className="tap lift group block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
		>
			<div className="flex items-center justify-between gap-3 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-2.5 md:px-5">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
					<span className="font-mono font-semibold text-[var(--color-ink-900)]">{order.orderNumber}</span>
					<span className="text-[var(--color-ink-400)]">·</span>
					<span className="text-[var(--color-ink-500)]">{formatStorefrontDate(order.placedAt)}</span>
				</div>
				<span className={classNames("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone.toneBg, tone.toneFg)}>
					<span className={classNames("size-1.5 rounded-full", tone.toneDot)} />
					{order.statusLabel}
				</span>
			</div>

			<div className="flex items-center gap-3 p-3 md:p-4">
				<div className="min-w-0 flex-1">
					{firstItem && (
						<div className="mb-1">
							<p className="line-clamp-1 text-[14px] font-semibold text-[var(--color-ink-900)]">
								{firstItem?.productName}
								{extraCount > 0 && (
									<span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-ink-100)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-ink-700)]">
										+{extraCount} more
									</span>
								)}
							</p>
							{firstItem.variantSummary && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[var(--color-ink-600)]">{firstItem.variantSummary}</p>}
						</div>
					)}
					<p className="mt-1.5 line-clamp-1 text-[12px] font-medium text-[var(--color-ink-700)]">
						{order.address?.street ? `Delivery to ${order.address.street}` : "Store Pickup"}
					</p>
					<p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--color-ink-500)]">
						{nextLabel ?? `${order.totals.itemCount} item${order.totals.itemCount === 1 ? "" : "s"}`}
					</p>
				</div>
				<div className="text-right">
					<p className="text-[14px] font-semibold tracking-tight text-[var(--color-ink-900)]">{formatPrice(order.totals.totalRupees)}</p>
					<p className="mt-0.5 hidden text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ink-400)] md:block">{order.delivery === "pickup" ? "Pickup" : "Delivery"}</p>
				</div>
				<ChevronRight size={15} className="text-[var(--color-ink-400)] transition-colors group-hover:text-[var(--color-accent-700)]" />
			</div>
		</Link>
	);
}

function Empty({ filter, onClearFilter }: { filter: FilterId; onClearFilter: () => void }) {
	const messages: Record<FilterId, string> = {
		all: "Your orders will live here once you place your first one.",
		active: "No active orders right now — everything is delivered or pending checkout.",
		delivered: "No delivered orders yet.",
		cancelled: "Nothing cancelled.",
	};
	return (
		<Card className="reveal flex flex-col items-center gap-4 p-10 text-center">
			<span className="grid size-12 place-items-center rounded-full bg-[var(--color-canvas-deep)] text-[var(--color-ink-500)]">
				<Package size={20} />
			</span>
			<p className="max-w-xs text-[13px] text-[var(--color-ink-600)]">{messages[filter]}</p>
			{filter === "all" ? (
				<ButtonLink href="/" variant="primary" size="sm" className="cta-arrow" trailingIcon={<ArrowUpRight size={14} strokeWidth={2.4} />}>
					Browse products
				</ButtonLink>
			) : (
				<button
					type="button"
					onClick={onClearFilter}
					className="tap focus-ring inline-flex h-9 items-center rounded-[var(--radius-full)] bg-[var(--color-accent-500)] px-4 text-[13px] font-semibold text-[var(--color-ink-900)] transition-colors hover:bg-[var(--color-accent-600)]"
				>
					Clear filter
				</button>
			)}
		</Card>
	);
}
