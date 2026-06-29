import { Activity, BadgePercent, FolderTree, MessageSquare, Package, Settings, ShieldCheck, ShoppingCart, UserCircle, type LucideIcon } from "lucide-react";

import { MobileHubRowLink } from "@/app/_components/dashboard/MobileHubRowLink";
import { getVerifiedSession, hasPermission } from "@/lib/permissions";
import { loadDashboardKpisCached } from "@/lib/cached";
import { NAV_ITEM_PERMISSIONS } from "@/components/layout/Sidebar";

interface HubGroup {
	title: string;
	rows: HubRow[];
}

interface HubRow {
	href: string;
	label: string;
	icon: LucideIcon;
	/** Optional trailing value (e.g. "3 pending"). Null falls back to a chevron only. */
	trailing?: string | null;
	/** When set, renders a small unread-dot badge fed by SidebarBadge. */
	badgeType?: "orders" | "customers" | "inquiries";
}

/** Mobile-only iOS-Settings-style nav hub. Rendered on the admin home page
 *  below the welcome banner so the operator can jump straight to a section.
 *  Uses the same KPI cache as the rest of the dashboard — no extra DB hit.
 *  Skips groups where the operator has no visible items (permission gating
 *  mirrors `Sidebar.NAV_ITEM_PERMISSIONS`). */
export async function MobileHubSections() {
	const [actor, kpis] = await Promise.all([getVerifiedSession(), loadDashboardKpisCached()]);
	if (!actor) return null;

	const groups: HubGroup[] = [
		{
			title: "Sales",
			rows: [
				{
					href: "/orders",
					label: "Orders",
					icon: ShoppingCart,
					trailing: kpis.pendingPayments > 0 ? `${kpis.pendingPayments} pending` : null,
					badgeType: "orders",
				},
				{
					href: "/inquiries",
					label: "Inquiries",
					icon: MessageSquare,
					badgeType: "inquiries",
				},
				{
					href: "/customers",
					label: "Customers",
					icon: UserCircle,
					trailing: kpis.totalCustomers > 0 ? formatCount(kpis.totalCustomers) : null,
					badgeType: "customers",
				},
			],
		},
		{
			title: "Catalog",
			rows: [
				{
					href: "/products",
					label: "Products",
					icon: Package,
					trailing: kpis.lowStockVariants > 0 ? `${kpis.lowStockVariants} low stock` : `${kpis.modelsListed} listed`,
				},
				{ href: "/categories", label: "Categories", icon: FolderTree },
				{ href: "/offers", label: "Offers", icon: BadgePercent },
			],
		},
		{
			title: "System",
			rows: [
				{ href: "/activity", label: "Activity log", icon: Activity },
				{ href: "/settings", label: "Settings", icon: Settings },
				{ href: "/team", label: "Team & roles", icon: ShieldCheck },
			],
		},
	];

	const visibleGroups = groups
		.map((group) => ({
			...group,
			rows: group.rows.filter((row) => {
				const permission = NAV_ITEM_PERMISSIONS[row.href];
				if (!permission) return true;
				return hasPermission(actor, permission);
			}),
		}))
		.filter((group) => group.rows.length > 0);

	if (visibleGroups.length === 0) {
		return null;
	}

	return (
		<div className="md:hidden">
			<div className="app-section">
				<div className="app-section-eyebrow">
					<span>Jump to</span>
				</div>
				<div className="space-y-3">
					{visibleGroups.map((group) => (
						<HubGroupCard key={group.title} group={group} />
					))}
				</div>
			</div>
		</div>
	);
}

function HubGroupCard({ group }: { group: HubGroup }) {
	return (
		<div>
			<p className="px-1 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">{group.title}</p>
			<ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
				{group.rows.map((row, index) => {
					const Icon = row.icon;
					return (
						<li key={row.href}>
							<MobileHubRowLink
								href={row.href}
								label={row.label}
								iconElement={<Icon size={16} strokeWidth={2} />}
								trailing={row.trailing}
								badgeType={row.badgeType}
								isLast={index === group.rows.length - 1}
							/>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function formatCount(value: number): string {
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
	}
	return String(value);
}
