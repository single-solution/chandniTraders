"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronsLeft, ChevronsRight, ShoppingBag } from "lucide-react";

import { NotificationsMenu } from "@/components/layout/NotificationsMenu";
import { UserMenu } from "@/components/layout/UserMenu";
import { useStoreSettings } from "@/lib/storeSettingsContext";

interface TopHeaderProps {
	isCollapsed: boolean;
	onToggleCollapsed: () => void;
}

export function TopHeader({ isCollapsed, onToggleCollapsed }: TopHeaderProps) {
	const router = useRouter();
	const { data: session } = useSession();
	const { siteName } = useStoreSettings();
	const user = session?.user;
	const brandShort = siteName?.split(" ")[0] ?? "Store";

	async function handleLogout() {
		await signOut({ redirect: false });
		router.replace("/login");
	}

	return (
		<header className="hidden h-11 shrink-0 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 shadow-[var(--shadow-sm)] md:flex">
			<div className="flex items-center gap-2">
				<button
					type="button"
					aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					onClick={onToggleCollapsed}
					className="tap grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]"
				>
					{isCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
				</button>
				<Link href="/" className="flex items-center gap-2 text-[var(--color-ink-900)]">
					<span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
						<ShoppingBag size={13} strokeWidth={2.4} />
					</span>
					<div className="leading-tight">
						<p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-700)]">Admin</p>
						<p className="text-xs font-semibold tracking-tight text-[var(--color-ink-900)]">{brandShort} HQ</p>
					</div>
				</Link>
			</div>

			<div className="flex items-center gap-2">
				<NotificationsMenu />
				<UserMenu name={user?.name ?? ""} email={user?.email ?? ""} role={user?.role ?? "support_staff"} isSuperAdmin={user?.isSuperAdmin === true} onLogout={handleLogout} />
			</div>
		</header>
	);
}
