"use client";

import type { ReactNode } from "react";
import { useNavigationProgressCount } from "@/lib/navigation/navigationProgress";

interface NavigationPendingFallbackProps {
	/** Skeleton (or any placeholder) to render while a nav transition is in flight. */
	fallback: ReactNode;
	/** Live server-rendered children — passed as a child slot so RSC streams through. */
	children: ReactNode;
}

/**
 * Swap children for `fallback` while any in-app navigation transition is
 * pending. Subscribes to the global navigation progress counter set by
 * `useNavigationTransition`; whenever something elsewhere on the page
 * fires a transition (e.g. a filter chip flip), this wrapper hides its
 * stale children and shows the skeleton until the new RSC payload
 * commits and the counter clears.
 *
 * Use to wrap server-rendered areas whose stale content should not
 * remain visible while the URL is settling — typically product grids,
 * lists, or paginated tables that read `searchParams` server-side.
 */
export function NavigationPendingFallback({ fallback, children }: NavigationPendingFallbackProps) {
	const isPending = useNavigationProgressCount() > 0;
	return isPending ? <>{fallback}</> : <>{children}</>;
}
