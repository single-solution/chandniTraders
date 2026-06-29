"use client";

import type { ReactNode } from "react";

interface RouteTransitionProps {
	children: ReactNode;
}

/**
 * Route content wrapper.
 *
 * Client navigations behave like a fresh load: the new route's Suspense
 * skeletons paint immediately, then the streamed content replaces them,
 * and per-section `.reveal` motion provides the entrance. The top
 * `NavigationProgress` bar owns the tap-feedback during the commit gap.
 *
 * We deliberately do NOT run a page-wide cross-fade / View Transition
 * here. Holding the previous page and swapping it inside
 * `startViewTransition()` lifted the captured `<main>` into the browser
 * top layer (painting over the fixed bottom tab bar) and produced a
 * content-then-skeleton flash on prefetched routes.
 *
 * `flex min-h-0 flex-1 flex-col` passes the shell's flex stretch through
 * to the page root, so a page that opts into `.storefront-page-center`
 * can fill exactly the space between header and footer.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
	return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
