/**
 * Streams a list workspace's collection-wide counts/stats in *after* the
 * first paint, so the rows render instantly and the heavy aggregates (order
 * status tallies, customer segment counts + loyalty totals) fill in behind a
 * shimmer instead of blocking the page.
 *
 * `refreshKey` should be the SSR seed (`initial`) the catalog already holds:
 * its identity changes on mount, on `router.refresh()` after a mutation, and
 * on a filter/search change, so the counts re-stream and stay exact. The
 * underlying endpoint is itself short-cached server-side, so re-fetches are
 * cheap.
 */
"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

interface DeferredCounts<TCounts> {
	/** Resolved counts, or `null` until the first successful load (or on error). */
	counts: TCounts | null;
	/** True while the request is in flight — drive the shimmer off this. */
	isLoading: boolean;
}

export function useDeferredCounts<TCounts>(endpoint: string, refreshKey: unknown): DeferredCounts<TCounts> {
	const [counts, setCounts] = useState<TCounts | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate loading state start
		setIsLoading(true);
		void (async () => {
			try {
				const data = await apiFetch<TCounts>(endpoint);
				if (!cancelled) {
					setCounts(data);
				}
			} catch {
				// Leave the last good counts in place; stop the shimmer so the slots
				// don't pulse forever on a transient failure.
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [endpoint, refreshKey]);

	return { counts, isLoading };
}
