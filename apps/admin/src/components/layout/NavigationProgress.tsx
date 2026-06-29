"use client";

import { useNavigationProgressCount } from "@/lib/navigation/navigationProgress";

/**
 * Thin top-of-viewport progress bar that animates while any tracked
 * router navigation is in flight. Driven by `useNavigationTransition`
 * (see `lib/navigation/navigationProgress.ts`) so it covers same-route
 * filter/sort/segment updates that don't trigger `loading.tsx`.
 *
 * Visibility is opacity-only — the bar mounts once, never unmounts, so
 * its keyframe animation stays in lockstep across rapid taps.
 */
export function NavigationProgress() {
	const isActive = useNavigationProgressCount() > 0;
	return (
		<div
			aria-hidden
			data-active={isActive ? "true" : "false"}
			className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-max)] h-[2px] overflow-hidden transition-opacity duration-200 data-[active=false]:opacity-0 data-[active=true]:opacity-100"
		>
			<span className="navigation-progress-bar block h-full w-1/3 bg-[var(--color-accent-500)]" />
		</div>
	);
}
