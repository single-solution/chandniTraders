"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * In-app navigation progress signal.
 *
 * Same-route URL updates (filter chips, segment toggles, search, sort,
 * pagination) never trigger `loading.tsx` — Next.js only fires segment
 * loaders on cross-segment navigation. That left workspace filter
 * toggles feeling stuck while the RSC round-trip completed in the
 * background. This module surfaces a single "anything in flight?"
 * boolean to a global top progress bar.
 *
 * IMPORTANT — we deliberately do NOT wrap the user's router call in
 * `useTransition`. Wrapping defers the commit of new searchParams to
 * client components until the RSC payload arrives, which made purely
 * client-derived swaps feel slower than before the bar existed.
 * Instead, the runner is invoked synchronously so the URL updates
 * instantly, and the counter is pinged for a short hold so the bar's
 * slide animation is always visible.
 */
let pendingCount = 0;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): number {
	return pendingCount;
}

function getServerSnapshot(): number {
	return 0;
}

function beginPing(): void {
	pendingCount += 1;
	notify();
}

function endPing(): void {
	pendingCount = Math.max(0, pendingCount - 1);
	notify();
}

/** Minimum duration the bar stays visible per ping — long enough for the
 *  slide animation to read, short enough to feel snappy. */
const NAV_PROGRESS_HOLD_MS = 360;

export function useNavigationProgressCount(): number {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Fire-and-forget pulse on the global progress bar. Use when you manage
 * your own `useTransition` (or otherwise have a non-hook nav site) and
 * just need the bar to flash.
 */
export function pingNavigationProgress(durationMs: number = NAV_PROGRESS_HOLD_MS): void {
	beginPing();
	window.setTimeout(endPing, durationMs);
}

/**
 * Hook for programmatic URL updates. Calling `startNavigation(run)`:
 *
 *  1. Pings the global progress bar **synchronously** so it lights up on
 *     the click frame.
 *  2. Defers the `run()` callback (which typically calls `router.replace`)
 *     to the next animation frame. Any optimistic state the caller set in
 *     the same event handler gets to paint first — then the navigation
 *     kicks off. Without this gap the optimistic update and the
 *     URL-driven re-render get coalesced into a single React commit, so
 *     the user sees both arrive together (i.e. only after RSC lands).
 *
 * `isPending` is a local UI flag (true between click and end of hold) for
 * call sites that want to dim their own control briefly.
 */
export function useNavigationTransition(): {
	isPending: boolean;
	startNavigation: (run: () => void) => void;
} {
	const timeoutRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const isPingedRef = useRef(false);
	const [isPending, setIsPending] = useState(false);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			if (isPingedRef.current) {
				endPing();
				isPingedRef.current = false;
			}
		};
	}, []);

	const startNavigation = useCallback((run: () => void) => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		if (rafRef.current !== null) {
			window.cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (!isPingedRef.current) {
			beginPing();
			isPingedRef.current = true;
			setIsPending(true);
		}
		// Defer the actual navigation by one animation frame so any optimistic
		// setState the caller queued in the same event handler paints first.
		rafRef.current = window.requestAnimationFrame(() => {
			rafRef.current = null;
			run();
			timeoutRef.current = window.setTimeout(() => {
				if (isPingedRef.current) {
					endPing();
					isPingedRef.current = false;
				}
				setIsPending(false);
				timeoutRef.current = null;
			}, NAV_PROGRESS_HOLD_MS);
		});
	}, []);

	return { isPending, startNavigation };
}
