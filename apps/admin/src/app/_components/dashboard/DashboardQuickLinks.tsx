"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PermissionKey } from "@/lib/permissionsCatalog";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { usePrefetchOnIntent } from "@/lib/navigation/usePrefetchOnIntent";

function EyebrowLink({ href, label, permission }: { href: string; label: string; permission?: PermissionKey }) {
	const { can, isLoading } = useAdminPermissions();
	const prefetchHandlers = usePrefetchOnIntent(href);
	if (permission && (isLoading || !can(permission))) {
		return null;
	}
	return (
		<Link
			href={href}
			onPointerDown={prefetchHandlers.onPointerDown}
			onTouchStart={prefetchHandlers.onTouchStart}
			onFocus={prefetchHandlers.onFocus}
			className="text-[11px] font-semibold text-[var(--color-accent-700)] hover:underline"
		>
			{label}
		</Link>
	);
}

export function DashboardMobileEyebrowActions({ variant }: { variant: "today" | "month" | "inquiries" }) {
	if (variant === "today") {
		return <EyebrowLink href="/products?wizard=1" label="+ Add product" permission="product_create" />;
	}
	if (variant === "month") {
		return <EyebrowLink href="/orders" label="View orders" permission="order_view" />;
	}
	return <EyebrowLink href="/inquiries" label="View all" permission="inquiry_view" />;
}

export function DashboardSectionActionLink({ href, label, permission }: { href: string; label: string; permission?: PermissionKey }) {
	const { can, isLoading } = useAdminPermissions();
	const prefetchHandlers = usePrefetchOnIntent(href);
	if (permission && (isLoading || !can(permission))) {
		return null;
	}
	return (
		<Link
			href={href}
			onPointerDown={prefetchHandlers.onPointerDown}
			onTouchStart={prefetchHandlers.onTouchStart}
			onFocus={prefetchHandlers.onFocus}
			className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent-700)] hover:underline"
		>
			{label} <ArrowRight size={12} />
		</Link>
	);
}
