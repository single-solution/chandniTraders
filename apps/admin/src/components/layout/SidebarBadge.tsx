"use client";

import { useSidebarSummary } from "@/lib/sidebarSummaryContext";
import { classNames } from "@store/shared";

export function SidebarBadge({ type, isCollapsed }: { type: "orders" | "customers" | "inquiries"; isCollapsed: boolean }) {
	const summary = useSidebarSummary();
	const count =
		type === "orders"
			? (summary?.ordersUnread ?? 0)
			: type === "customers"
				? (summary?.customersUnread ?? 0)
				: (summary?.inquiriesUnread ?? 0);

	if (count <= 0) return null;

	if (isCollapsed) {
		return <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500" aria-label={`${count} unread`} />;
	}

	return (
		<span className="ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{count > 99 ? "99+" : count}</span>
	);
}
