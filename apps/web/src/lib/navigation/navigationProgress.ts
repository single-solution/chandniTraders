"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, useTransition } from "react";

/**
 * In-app navigation progress signal.
 *
 * Same-route URL updates (filter chips, view-mode tabs, sort, pagination)
 * never trigger `loading.tsx` — Next.js only fires segment loaders on
 * cross-segment navigation. That left filter toggles feeling stuck while
 * the RSC round-trip completed in the background.
 *
 * Pending detection is driven by React's `useTransition`: we wrap the
 * router call in `startTransition`, then `isPending` is true from the
 * click frame until the RSC payload commits. The hook mirrors that
 * pending state into a global counter so any subscriber (progress bar,
 * products-area skeleton overlay) can react.
 *
 * Optimistic UI is the caller's responsibility — they call setState in
 * the same handler, outside any transition, so it commits as an urgent
 * update and paints before the transition starts.
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

/** Minimum hold so single-frame transitions still light up the bar (and
 *  swap the skeleton in) for a beat — long enough for the eye to catch. */
const NAV_PROGRESS_MIN_HOLD_MS = 220;

export function useNavigationProgressCount(): number {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for programmatic URL updates. Calling `startNavigation(run)`:
 *
 *  1. Defers `run()` (which typically calls `router.replace`) to the next
 *     animation frame so any urgent optimistic setState the caller queued
 *     in the same event handler paints first.
 *  2. Invokes `run()` inside `startTransition`. React's `isPending` is then
 *     true from that frame until the RSC payload commits — an accurate
 *     end-of-navigation signal, replacing the old fixed-time timer.
 *  3. Mirrors `isPending` into the global progress counter so the top
 *     progress bar and any skeleton overlays react automatically. A short
 *     min-hold keeps the bar legible on snap-fast transitions.
 *
 * `isPending` is true between click and the moment the new server tree
 * commits — callers can use it to gate UI (dim controls, show skeleton).
 */
export function useNavigationTransition(): {
	isPending: boolean;
	startNavigation: (run: () => void) => void;
} {
	const rafRef = useRef<number | null>(null);
	const endTimeoutRef = useRef<number | null>(null);
	const isPingedRef = useRef(false);
	const minHoldUntilRef = useRef(0);
	const [isPending, startTransition] = useTransition();

	// Mirror React's transition pending state into the global counter so the
	// progress bar and the products-area skeleton overlay light up. We also
	// enforce a brief min-hold so fast transitions still register visually.
	useEffect(() => {
		if (isPending) {
			if (endTimeoutRef.current !== null) {
				window.clearTimeout(endTimeoutRef.current);
				endTimeoutRef.current = null;
			}
			if (!isPingedRef.current) {
				beginPing();
				isPingedRef.current = true;
			}
			minHoldUntilRef.current = Date.now() + NAV_PROGRESS_MIN_HOLD_MS;
		} else if (isPingedRef.current) {
			const remaining = Math.max(0, minHoldUntilRef.current - Date.now());
			endTimeoutRef.current = window.setTimeout(() => {
				endPing();
				isPingedRef.current = false;
				endTimeoutRef.current = null;
			}, remaining);
		}
	}, [isPending]);

	useEffect(() => {
		return () => {
			if (endTimeoutRef.current !== null) {
				window.clearTimeout(endTimeoutRef.current);
				endTimeoutRef.current = null;
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

	const startNavigation = useCallback(
		(run: () => void) => {
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			// Defer the actual navigation by one animation frame so any optimistic
			// setState the caller queued in the same event handler paints first.
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null;
				startTransition(() => {
					run();
				});
			});
		},
		[startTransition],
	);

	return { isPending, startNavigation };
}
