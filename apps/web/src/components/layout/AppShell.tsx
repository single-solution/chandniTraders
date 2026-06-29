"use client";

import { Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileBottomTabBar } from "@/components/layout/MobileBottomTabBar";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { WebVitalsReporter } from "@/components/layout/WebVitalsReporter";
import { StoreNoticeBanner } from "@/components/layout/StoreNoticeBanner";
import { RevealRoot } from "@/components/shared/motion/RevealRoot";
import { RouteTransition } from "@/components/shared/motion/RouteTransition";
import { ToastProvider } from "@/components/ui/Toast";
import { CartReconciliationRunner } from "@/lib/cart/useCartReconciliation";
import { IdleRoutePrefetch } from "@/components/layout/IdleRoutePrefetch";

/**
 * Lazy-load a non-critical client island. Swallows `ChunkLoadError` when a
 * dev HMR pass leaves the browser holding a stale chunk hash — the island
 * is skipped instead of crashing the layout.
 */
function deferredIsland<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
	return dynamic(() => loader().catch(() => ({ default: () => null })), { ssr: false, loading: () => null });
}

function deferredNamedIsland<P extends object>(loader: () => Promise<Record<string, ComponentType<P>>>, exportName: string): ComponentType<P> {
	return deferredIsland(() => loader().then((module) => ({ default: module[exportName] })));
}

/* Deferred client islands — split into separate chunks and mounted on the
   next idle frame (or 1.5 s after FCP) to cut Total Blocking Time.
   `WebVitalsReporter` is imported statically: it renders null and is
   tiny; a dynamic chunk for it was prone to ChunkLoadError after HMR. */
const ChatFabShell = deferredNamedIsland(() => import("@/app/_components/chat/ChatFabShell"), "ChatFabShell");
const SearchOverlay = deferredNamedIsland(() => import("@/components/layout/SearchOverlay"), "SearchOverlay");
const AirFlowBackground = deferredNamedIsland(() => import("@/components/shared/motion/AirFlowBackground"), "AirFlowBackground");

interface AppShellProps {
	children: React.ReactNode;
	/** Server-rendered footer element, injected as a slot so it stays out of
	 *  the client bundle. */
	footer: React.ReactNode;
}

/** Hard ceiling on the idle wait so chat FAB / search overlay aren't hidden forever. */
const DEFERRED_MOUNT_TIMEOUT_MS = 1500;

export function AppShell({ children, footer }: AppShellProps) {
	const pathname = usePathname();
	const isAdminRoute = pathname?.startsWith("/admin") ?? false;

	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [areDeferredMounted, setAreDeferredMounted] = useState(false);

	useEffect(() => {
		if (areDeferredMounted) return;
		const supportsIdle = typeof window.requestIdleCallback === "function";
		if (supportsIdle) {
			const handle = window.requestIdleCallback(() => setAreDeferredMounted(true), { timeout: DEFERRED_MOUNT_TIMEOUT_MS });
			return () => window.cancelIdleCallback(handle);
		}
		const handle = window.setTimeout(() => setAreDeferredMounted(true), DEFERRED_MOUNT_TIMEOUT_MS);
		return () => window.clearTimeout(handle);
	}, [areDeferredMounted]);

	/* If the user taps the search trigger before the idle callback fires,
     force-mount the deferred chunks immediately so the overlay can render
     in response. Without this, an extremely fast tap (< 1.5 s after FCP)
     would no-op until the gate opened. */
	const openSearch = useCallback(() => {
		setAreDeferredMounted(true);
		setIsSearchOpen(true);
	}, []);

	if (isAdminRoute) {
		return <>{children}</>;
	}

	// We deliberately do NOT key `<main>` on `pathname`. Keying re-mounts the
	// element on every route change and makes navigation feel laggy. Instead,
	// `RouteTransition` applies a light cross-fade when the route commits.
	return (
		<ToastProvider>
			<CartReconciliationRunner />
			<div className="app-shell-pad flex min-h-dvh flex-col">
				<a
					href="#main-content"
					className="sr-only rounded-full bg-[var(--color-ink-900)] px-4 py-2 text-[13px] font-semibold text-[var(--color-canvas)] focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[90]"
				>
					Skip to content
				</a>
				<RevealRoot />
				<AirFlowBackground />
				{!isAdminRoute ? <IdleRoutePrefetch /> : null}
				{areDeferredMounted ? <WebVitalsReporter /> : null}
				<NavigationProgress />
				<StoreNoticeBanner />
				<Header onOpenSearch={openSearch} />
				<MobileHeader onOpenSearch={openSearch} />
				<main id="main-content" tabIndex={-1} className="app-main flex flex-1 flex-col outline-none">
					<RouteTransition>{children}</RouteTransition>
				</main>
				{footer}
				{areDeferredMounted ? <ChatFabShell /> : null}
				<MobileBottomTabBar />
				{areDeferredMounted ? <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} /> : null}
			</div>
		</ToastProvider>
	);
}
