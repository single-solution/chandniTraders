"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Menu, ShoppingBag } from "lucide-react";

import { getInitials } from "@/lib/initials";
import { useStoreSettings } from "@/lib/storeSettingsContext";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { totalAdminAlertCount, useAdminAlerts } from "@/app/_components/dashboard/alertsUi";

interface MobileTopBarProps {
	onOpenMenu: () => void;
}

/** Where the bell badge sends the user. Picks the highest-priority alert
 *  (unread inquiries > pending payments > low stock) and falls back to the
 *  inbox if every counter is zero. */
function bellHref(alertCount: { unreadInquiries: number; pendingPayments: number; lowStockVariants: number }): string {
	if (alertCount.unreadInquiries > 0) return "/inquiries";
	if (alertCount.pendingPayments > 0) return "/orders";
	if (alertCount.lowStockVariants > 0) return "/products";
	return "/inquiries";
}

const MAX_BADGE_COUNT = 9;

export function MobileTopBar({ onOpenMenu }: MobileTopBarProps) {
	const { data: session } = useSession();
	const { siteName } = useStoreSettings();
	const { can } = useAdminPermissions();
	const alerts = useAdminAlerts();
	const initials = getInitials(session?.user?.name);
	const brandShort = siteName?.split(" ")[0] ?? "Store";

	const visibleAlerts = {
		unreadInquiries: can("inquiry_view") ? alerts.unreadInquiries : 0,
		pendingPayments: can("order_view") ? alerts.pendingPayments : 0,
		lowStockVariants: can("product_view") ? alerts.lowStockVariants : 0,
	};
	const badgeCount = totalAdminAlertCount({
		...visibleAlerts,
		openInquiries: 0,
	});
	const badgeLabel = badgeCount > MAX_BADGE_COUNT ? "9+" : String(badgeCount);

	return (
		<header className="safe-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 md:hidden">
			<button
				type="button"
				onClick={onOpenMenu}
				aria-label="Open admin menu"
				className="grid size-11 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-700)] active:bg-[var(--color-canvas-deep)]"
			>
				<Menu size={20} />
			</button>

			<Link href="/" className="flex min-w-0 items-center gap-2 text-[var(--color-ink-900)]">
				<span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
					<ShoppingBag size={14} strokeWidth={2.6} />
				</span>
				<div className="min-w-0 leading-tight">
					<p className="text-[0.594rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-700)]">Admin</p>
					<p className="truncate text-[0.8125rem] font-semibold tracking-tight text-[var(--color-ink-900)]">{brandShort} HQ</p>
				</div>
			</Link>

			<div className="ml-auto flex items-center gap-1">
				<Link
					href={bellHref(visibleAlerts)}
					aria-label={badgeCount > 0 ? `${badgeCount} pending notification${badgeCount === 1 ? "" : "s"}` : "No notifications"}
					className="relative grid size-11 place-items-center rounded-full text-[var(--color-ink-600)] active:bg-[var(--color-canvas-deep)]"
				>
					<Bell size={18} />
					{badgeCount > 0 ? (
						<span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--color-accent-500)] px-1 text-[0.5625rem] font-bold text-[var(--color-ink-900)]">
							{badgeLabel}
						</span>
					) : null}
				</Link>
				<span aria-hidden className="grid size-9 place-items-center rounded-full bg-[var(--color-accent-500)] text-[0.6875rem] font-semibold text-[var(--color-ink-900)]">
					{initials}
				</span>
			</div>
		</header>
	);
}
