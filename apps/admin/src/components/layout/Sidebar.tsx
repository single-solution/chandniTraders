"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BadgePercent, ExternalLink, FolderTree, LayoutDashboard, MessageSquare, Package, Settings, ShieldCheck, ShoppingCart, UserCircle } from "lucide-react";
import { classNames } from "@store/shared";

import { SidebarBadge } from "./SidebarBadge";
import { usePrefetchOnIntent } from "@/lib/navigation/usePrefetchOnIntent";
import { resolvePublicSiteUrl } from "@store/shared";
import { useStoreSettings } from "@/lib/storeSettingsContext";
import { useAdminPermissions } from "@/lib/permissionsContext";

import type { PermissionKey } from "@/lib/permissionsCatalog";

interface SidebarSection {
	title: string;
	items: SidebarItem[];
}

interface SidebarItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
	exact?: boolean;
	permission?: PermissionKey;
}

/** Nav items hidden when the signed-in user lacks the permission key. */
export const NAV_ITEM_PERMISSIONS: Partial<Record<string, PermissionKey>> = {
	"/orders": "order_view",
	"/inquiries": "inquiry_view",
	"/customers": "customer_view",
	"/products": "product_view",
	"/categories": "category_manage",
	"/offers": "offer_manage",
	"/activity": "activity_view",
	"/settings": "settings_view",
	"/team": "team_view",
};

export const SIDEBAR_SECTIONS: SidebarSection[] = [
	{
		title: "Overview",
		items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
	},
	{
		title: "Sales",
		items: [
			{ href: "/orders", label: "Orders", icon: ShoppingCart },
			{ href: "/inquiries", label: "Inquiries", icon: MessageSquare },
			{ href: "/customers", label: "Customers", icon: UserCircle },
		],
	},
	{
		title: "Catalog",
		items: [
			{ href: "/products", label: "Products", icon: Package },
			{ href: "/categories", label: "Categories", icon: FolderTree },
			{ href: "/offers", label: "Offers", icon: BadgePercent },
		],
	},
	{
		title: "System",
		items: [
			{ href: "/activity", label: "Activity log", icon: Activity },
			{ href: "/settings", label: "Settings", icon: Settings },
			{ href: "/team", label: "Team & roles", icon: ShieldCheck },
		],
	},
];

interface SidebarProps {
	isCollapsed: boolean;
}

export function isNavItemVisible(href: string, can: (permission: PermissionKey) => boolean, isLoading: boolean): boolean {
	const permission = NAV_ITEM_PERMISSIONS[href];
	if (!permission) {
		return true;
	}
	if (isLoading) {
		return false;
	}
	return can(permission);
}

export function Sidebar({ isCollapsed }: SidebarProps) {
	const pathname = usePathname() ?? "";
	const { publicSiteUrl: configuredStorefrontUrl } = useStoreSettings();
	const publicSiteUrl = resolvePublicSiteUrl(configuredStorefrontUrl);
	const { can, isLoading } = useAdminPermissions();

	return (
		<aside
			className={classNames(
				"flex shrink-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] text-[var(--color-ink-700)] shadow-[var(--shadow-sm)] transition-[width] duration-200",
				isCollapsed ? "w-12" : "w-48",
			)}
		>
			<nav className="flex-1 overflow-y-auto py-2.5">
				{SIDEBAR_SECTIONS.map((section) => (
					<div key={section.title} className="mb-3">
						{!isCollapsed && <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">{section.title}</p>}
						<ul className="space-y-1 px-1.5">
							{section.items
								.filter((link) => isNavItemVisible(link.href, can, isLoading))
								.map((link) => {
									const isActive = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);

									let badgeType: "orders" | "customers" | "inquiries" | undefined;
									if (link.href === "/orders" && can("order_view")) badgeType = "orders";
									if (link.href === "/customers" && can("customer_view")) badgeType = "customers";
									if (link.href === "/inquiries" && can("inquiry_view")) badgeType = "inquiries";

									return (
										<li key={link.href}>
											<SidebarNavLink link={link} isActive={isActive} isCollapsed={isCollapsed} badgeType={badgeType} />
										</li>
									);
								})}
						</ul>
					</div>
				))}
			</nav>

			<footer className="shrink-0 border-t border-[var(--color-ink-100)] p-2">
				<Link
					href={publicSiteUrl}
					target="_blank"
					rel="noopener noreferrer"
					title="View storefront"
					className={classNames(
						"flex items-center gap-2 border border-[var(--color-ink-100)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-ink-700)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-ink-200)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
						isCollapsed ? "mx-auto size-9 shrink-0 justify-center rounded-[var(--radius-md)]" : "h-9 w-full rounded-[var(--radius-md)] px-3",
					)}
				>
					<ExternalLink size={14} aria-hidden className="shrink-0" />
					{!isCollapsed ? <span className="min-w-0 truncate">View storefront</span> : null}
				</Link>
			</footer>
		</aside>
	);
}

interface SidebarNavLinkProps {
	link: SidebarItem;
	isActive: boolean;
	isCollapsed: boolean;
	badgeType?: "orders" | "customers" | "inquiries";
}

function SidebarNavLink({ link, isActive, isCollapsed, badgeType }: SidebarNavLinkProps) {
	const Icon = link.icon;
	const prefetchHandlers = usePrefetchOnIntent(isActive ? null : link.href);
	return (
		<Link
			href={link.href}
			title={isCollapsed ? link.label : undefined}
			onPointerDown={prefetchHandlers.onPointerDown}
			onTouchStart={prefetchHandlers.onTouchStart}
			onFocus={prefetchHandlers.onFocus}
			className={classNames(
				"tap relative flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] text-[13px] transition-colors",
				isCollapsed ? "justify-center px-0" : "px-2.5",
				isActive
					? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-800)]"
					: "font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
			)}
		>
			<Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
			{!isCollapsed && <span className="truncate">{link.label}</span>}
			{badgeType ? <SidebarBadge type={badgeType} isCollapsed={isCollapsed} /> : null}
		</Link>
	);
}
