"use client";

import { X } from "lucide-react";

export type CustomerDetailTab = "overview" | "profile" | "addresses" | "orders" | "loyalty" | "inquiries" | "activity";

export function CustomerErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
	return (
		<div role="alert" className="flex items-start justify-between gap-2 rounded-[var(--radius-md)] border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
			<p className="min-w-0 flex-1 leading-relaxed">{message}</p>
			{onDismiss ? (
				<button type="button" aria-label="Dismiss error" onClick={onDismiss} className="shrink-0 rounded p-0.5 text-rose-600 hover:bg-rose-100">
					<X size={12} />
				</button>
			) : null}
		</div>
	);
}

export function CustomerStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{label}</p>
			<p className="mt-1 text-sm font-semibold text-[var(--color-ink-900)]">{value}</p>
			{sub ? <p className="mt-0.5 text-[10px] text-[var(--color-ink-500)]">{sub}</p> : null}
		</div>
	);
}
