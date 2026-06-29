"use client";

import { useEffect, useState, type ReactNode, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { Footer } from "@/components/layout/Footer";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { AdminPermissionsProvider } from "@/lib/permissionsContext";
import { RevealRoot } from "@/components/shared/motion/RevealRoot";
import { RouteTransition } from "@/components/shared/motion/RouteTransition";

import type { PermissionKey } from "@/lib/permissionsCatalog";
import { SidebarSummaryProvider } from "@/lib/sidebarSummaryContext";

interface ShellProps {
	children: ReactNode;
	initialSession?: {
		id: string;
		name: string;
		permissions: PermissionKey[];
	} | null;
}

/** Routes that render bare (no chrome, no session gate) inside the shell. */
function isPublicRoute(pathname: string): boolean {
	return pathname === "/login" || pathname.startsWith("/login/");
}

export function Shell({ children, initialSession = null }: ShellProps) {
	const router = useRouter();
	const pathname = usePathname() ?? "";
	const { status } = useSession();

	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const isPublic = isPublicRoute(pathname);

	useEffect(() => {
		if (!isPublic && status === "unauthenticated") {
			const callbackUrl = pathname ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
			router.replace(`/login${callbackUrl}`);
		}
	}, [isPublic, status, pathname, router]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- navigation-driven UI reset
		setIsMobileMenuOpen(false);
	}, [pathname]);

	// Login / public routes render their own full-screen UI without the admin
	// chrome or the session gate (the shell still persists across navigations).
	if (isPublic) {
		return <>{children}</>;
	}

	if (status !== "authenticated") {
		return (
			<div className="grid h-screen place-items-center bg-[var(--color-canvas)]">
				<p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-500)]">Loading admin…</p>
			</div>
		);
	}

	return (
		<AdminPermissionsProvider initialSession={initialSession}>
			<SidebarSummaryProvider>
				<Suspense fallback={null}>
					<RevealRoot />
				</Suspense>
				<NavigationProgress />
				<div className="flex min-h-screen flex-col bg-[var(--color-canvas-deep)] md:h-screen md:gap-2 md:overflow-hidden md:p-2">
				<div className="md:hidden">
					<MobileTopBar onOpenMenu={() => setIsMobileMenuOpen(true)} />
				</div>

				<TopHeader isCollapsed={isCollapsed} onToggleCollapsed={() => setIsCollapsed((current) => !current)} />

				<div className="flex min-h-0 flex-1 md:gap-2">
					<div className="hidden md:flex">
						<Sidebar isCollapsed={isCollapsed} />
					</div>

					<div className="flex min-w-0 flex-1 flex-col md:gap-2">
						<main className="app-main flex flex-1 flex-col overflow-hidden md:rounded-[var(--radius-lg)] md:border md:border-[var(--color-ink-100)] md:bg-[var(--color-surface)] md:shadow-[var(--shadow-sm)]">
							<RouteTransition>{children}</RouteTransition>
						</main>

						<Footer />
					</div>
				</div>

				<MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
				</div>
			</SidebarSummaryProvider>
		</AdminPermissionsProvider>
	);
}
