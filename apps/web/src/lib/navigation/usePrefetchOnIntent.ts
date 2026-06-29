"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { prefetchAllowed } from "@/lib/navigation/prefetchAllowed";

/**
 * Touch/pointer-down prefetch handler for any element navigating to
 * `href`. Use it alongside the default `<Link prefetch>` viewport
 * behaviour to give the *clicked* link priority: the moment a finger
 * lands or a mouse button presses, we promote `href` to the top of the
 * router cache queue so by the time the click event fires (~80–150 ms
 * later) the RSC payload is already on its way.
 *
 * Idempotent — once a given `href` is prefetched we don't fire again
 * until it changes. Network-aware via `prefetchAllowed()`: callers on
 * 2g / Data Saver get nothing.
 *
 * @returns props to spread onto an `<a>` / `<Link>` / `<button>`.
 */
export function usePrefetchOnIntent(href: string | undefined | null): {
	onPointerDown?: () => void;
	onTouchStart?: () => void;
	onFocus?: () => void;
} {
	const router = useRouter();
	const prefetchedRef = useRef<string | null>(null);

	useEffect(() => {
		prefetchedRef.current = null;
	}, [href]);

	const prefetch = useCallback(() => {
		if (!href) {
			return;
		}
		if (prefetchedRef.current === href) {
			return;
		}
		if (!prefetchAllowed()) {
			return;
		}
		prefetchedRef.current = href;
		try {
			router.prefetch(href);
		} catch {
			// Router rejects malformed URLs / cross-origin hrefs — swallow,
			// the actual click still goes through normal navigation.
			prefetchedRef.current = null;
		}
	}, [href, router]);

	if (!href) {
		return {};
	}
	return {
		onPointerDown: prefetch,
		onTouchStart: prefetch,
		onFocus: prefetch,
	};
}
