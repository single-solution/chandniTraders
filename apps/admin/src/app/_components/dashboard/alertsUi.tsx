"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { classNames } from "@store/shared";

import { apiFetch } from "@/lib/api";
import { useAdminPermissions } from "@/lib/permissionsContext";
import type { AlertSummary } from "@/lib/server/alertSummary";

/** Empty placeholder so the UI never flashes "undefined" while the first
 *  /api/alerts/summary request is in flight. */
const EMPTY_ALERTS: AlertSummary = {
	unreadInquiries: 0,
	pendingPayments: 0,
	lowStockVariants: 0,
	openInquiries: 0,
};

const ALERTS_REFRESH_MS = 60_000;

/** Subscribes to /api/alerts/summary and re-fetches every minute. Shared by
 *  the desktop footer, mobile top bar bell badge, and mobile menu alert row
 *  so all surfaces agree on the same numbers. */
export function useAdminAlerts(): AlertSummary {
	const [alerts, setAlerts] = useState<AlertSummary>(EMPTY_ALERTS);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const data = await apiFetch<AlertSummary>("/api/alerts/summary");
				if (!cancelled) setAlerts(data);
			} catch {
				// Best-effort badge — keep the last good value on error.
			}
		}

		void load();
		const timer = window.setInterval(() => void load(), ALERTS_REFRESH_MS);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);

	return alerts;
}

/** Total notifications worth surfacing as a single bell badge. */
export function totalAdminAlertCount(alerts: AlertSummary): number {
	return alerts.unreadInquiries + alerts.pendingPayments + alerts.lowStockVariants;
}

interface AdminAlertPillProps {
	href: string;
	label: string;
	tone?: "neutral" | "warn" | "danger";
	onClick?: () => void;
}

export function AdminAlertPill({ href, label, tone = "neutral", onClick }: AdminAlertPillProps) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className={classNames(
				"inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-full)] border px-2 py-0.5 text-[10px] font-semibold transition-colors",
				tone === "danger" && "border-[var(--color-rose-200)] bg-[var(--color-rose-50)] text-[var(--color-rose-800)] hover:border-[var(--color-rose-300)]",
				tone === "warn" && "border-[var(--color-accent-200)] bg-[var(--color-accent-50)] text-[var(--color-accent-900)] hover:border-[var(--color-accent-300)]",
				tone === "neutral" &&
					"border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-600)] hover:border-[var(--color-ink-200)] hover:text-[var(--color-ink-900)]",
			)}
		>
			{label}
		</Link>
	);
}

interface AdminAlertsRowProps {
	alerts: AlertSummary;
	onNavigate?: () => void;
	emptyLabel?: string;
	className?: string;
}

/** Shared alert pill row used by Footer (desktop) and MobileMenu
 *  (phones). Hides pills the current user has no permission to follow. */
export function AdminAlertsRow({ alerts, onNavigate, emptyLabel = "All clear — no alerts right now", className }: AdminAlertsRowProps) {
	const { can } = useAdminPermissions();
	const hasAlerts = alerts.unreadInquiries > 0 || alerts.pendingPayments > 0 || alerts.lowStockVariants > 0;

	if (!hasAlerts) {
		return (
			<span className={classNames("inline-flex shrink-0 items-center gap-1 text-[var(--color-ink-500)]", className)}>
				<span className="grid size-1.5 place-items-center rounded-full bg-emerald-500" aria-hidden />
				{emptyLabel}
			</span>
		);
	}

	return (
		<div className={classNames("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
			{alerts.unreadInquiries > 0 && can("inquiry_view") ? (
				<AdminAlertPill href="/inquiries" tone="danger" onClick={onNavigate} label={`${alerts.unreadInquiries} unread inquir${alerts.unreadInquiries === 1 ? "y" : "ies"}`} />
			) : null}
			{alerts.pendingPayments > 0 && can("order_view") ? (
				<AdminAlertPill href="/orders" tone="warn" onClick={onNavigate} label={`${alerts.pendingPayments} pending payment${alerts.pendingPayments === 1 ? "" : "s"}`} />
			) : null}
			{alerts.lowStockVariants > 0 && can("product_view") ? (
				<AdminAlertPill href="/products" tone="warn" onClick={onNavigate} label={`${alerts.lowStockVariants} low stock`} />
			) : null}
			{alerts.openInquiries > 0 && alerts.unreadInquiries === 0 && can("inquiry_view") ? (
				<AdminAlertPill href="/inquiries" tone="neutral" onClick={onNavigate} label={`${alerts.openInquiries} open inquir${alerts.openInquiries === 1 ? "y" : "ies"}`} />
			) : null}
		</div>
	);
}
