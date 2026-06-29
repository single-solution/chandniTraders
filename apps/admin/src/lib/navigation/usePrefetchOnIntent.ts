"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { prefetchAllowed } from "@/lib/navigation/prefetchAllowed";

/**
 * Pointer/touch/focus-down prefetch handler for admin nav.
 *
 * Same shape as the storefront helper: spread the returned handlers
 * onto a `<Link>` / `<button>` to promote `href` to the top of the
 * router cache queue the moment the operator's finger or mouse
 * presses down — usually 80–150 ms before the click event fires.
 *
 * Idempotent per `href`. Skipped when bandwidth is constrained.
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
