"use client";

import type { ReactNode } from "react";

interface RouteTransitionProps {
	children: ReactNode;
}

/**
 * Route content wrapper.
 *
 * Navigations commit skeleton-first like a fresh load: the new route's
 * Suspense fallbacks paint immediately, then the streamed content replaces
 * them. We deliberately do NOT run a page-wide cross-fade / View Transition
 * here — holding the previous page and swapping it inside
 * `startViewTransition()` lifted the captured `<main>` into the browser top
 * layer (painting over the persistent shell) and double-committed the tree.
 *
 * `flex min-h-0 flex-1 flex-col` passes the shell's flex stretch through to
 * the page root.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
	return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
