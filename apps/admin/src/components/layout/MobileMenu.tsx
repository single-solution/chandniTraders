"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronRight, ExternalLink, LogOut, ShoppingBag } from "lucide-react";
import { Flyout } from "@/components/ui/Flyout";
import { SIDEBAR_SECTIONS, isNavItemVisible } from "@/components/layout/Sidebar";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { classNames } from "@store/shared";

import { formatRole, getInitials } from "@/lib/initials";
import { resolvePublicSiteUrl } from "@store/shared";
import { useStoreSettings } from "@/lib/storeSettingsContext";
import { AdminAlertsRow, useAdminAlerts } from "@/app/_components/dashboard/alertsUi";

interface MobileMenuProps {
	isOpen: boolean;
	onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
	const pathname = usePathname() ?? "";
	const router = useRouter();
	const { data: session } = useSession();
	const { siteName, publicSiteUrl: configuredStorefrontUrl } = useStoreSettings();
	const { can, isLoading } = useAdminPermissions();
	const user = session?.user;
	const brandShort = siteName?.split(" ")[0] ?? "Store";
	const publicSiteUrl = resolvePublicSiteUrl(configuredStorefrontUrl);

	async function handleLogout() {
		onClose();
		await signOut({ redirect: false });
		router.replace("/login");
	}

	const userName = user?.name ?? "Admin";
	const userRole = user?.isSuperAdmin ? "Owner" : formatRole(user?.role ?? "staff");
	const alerts = useAdminAlerts();

	return (
		<Flyout isOpen={isOpen} onClose={onClose} side="left" width="md" showCloseButton={false}>
			<div className="-mx-4 -mt-4 flex items-center gap-2.5 border-b border-[var(--color-ink-100)] px-4 py-3.5">
				<span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
					<ShoppingBag size={15} strokeWidth={2.6} />
				</span>
				<div className="min-w-0 leading-tight">
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Admin</p>
					<p className="truncate text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">{brandShort} HQ</p>
				</div>
			</div>

			<div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2">
				<p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-400)]">Today&apos;s alerts</p>
				<AdminAlertsRow alerts={alerts} onNavigate={onClose} />
			</div>

			<nav className="mt-3">
				{SIDEBAR_SECTIONS.map((section) => (
					<div key={section.title} className="mb-3">
						<p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-400)]">{section.title}</p>
						<ul className="space-y-0.5">
							{section.items
								.filter((link) => isNavItemVisible(link.href, can, isLoading))
								.map((link) => {
									const isActive = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
									const Icon = link.icon;
									return (
										<li key={link.href}>
											<Link
												href={link.href}
												onClick={onClose}
												className={classNames(
													"flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[14px]",
													isActive
														? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-800)]"
														: "font-medium text-[var(--color-ink-800)] active:bg-[var(--color-canvas-deep)]",
												)}
											>
												<Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
												<span>{link.label}</span>
												<ChevronRight size={14} className={classNames("ml-auto", isActive ? "text-[var(--color-accent-700)]" : "text-[var(--color-ink-300)]")} />
											</Link>
										</li>
									);
								})}
						</ul>
					</div>
				))}
			</nav>

			<div className="mt-3 border-t border-[var(--color-ink-100)] pt-3">
				<Link
					href={publicSiteUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13px] font-medium text-[var(--color-ink-700)] active:bg-[var(--color-canvas-deep)]"
				>
					<ExternalLink size={14} />
					View storefront
				</Link>

				<div className="mt-2 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] p-2.5">
					<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)] text-[12px] font-semibold text-[var(--color-ink-900)]">
						{getInitials(userName)}
					</span>
					<div className="min-w-0 flex-1 leading-tight">
						<p className="truncate text-[13px] font-semibold text-[var(--color-ink-900)]">{userName}</p>
						<p className="truncate text-[11px] text-[var(--color-ink-500)]">{userRole}</p>
					</div>
					<button
						type="button"
						onClick={handleLogout}
						aria-label="Log out"
						className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-ink-500)] active:bg-[var(--color-surface)]"
					>
						<LogOut size={14} />
					</button>
				</div>
			</div>
		</Flyout>
	);
}
