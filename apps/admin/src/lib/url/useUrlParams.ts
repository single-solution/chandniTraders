"use client";

import { useCallback, useMemo, type MutableRefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";

export type UrlParamPatch = Record<string, string | null | undefined>;

export interface AdminUrlReplaceOptions {
	scroll?: boolean;
	/**
	 * Update the address bar without Next.js navigation — avoids RSC refetch on
	 * high-frequency workspace params (e.g. variant `vgrade` / `vuid`).
	 */
	historyOnly?: boolean;
}

/**
 * Push admin list/workspace state into the URL (shareable, back-button friendly).
 * Uses a pending-ref guard so programmatic `replace()` does not fight URL-driven effects.
 *
 * Same-route updates are wrapped in `useNavigationTransition` so the global
 * progress bar surfaces the RSC round-trip — without that, filter/segment
 * toggles felt frozen until the new payload committed. `historyOnly`
 * updates bypass the transition because nothing is fetched.
 */
export function useUrlParams() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { isPending, startNavigation } = useNavigationTransition();

	const params = useMemo(() => new URLSearchParams(searchParams?.toString() ?? ""), [searchParams]);

	const replace = useCallback(
		(patch: UrlParamPatch, options?: AdminUrlReplaceOptions) => {
			const next = new URLSearchParams(params.toString());
			for (const [key, value] of Object.entries(patch)) {
				if (value === null || value === undefined || value === "") {
					next.delete(key);
				} else {
					next.set(key, String(value));
				}
			}
			const query = next.toString();
			const url = query ? `${pathname}?${query}` : pathname;
			if (options?.historyOnly && typeof window !== "undefined") {
				window.history.replaceState(window.history.state, "", url);
				return;
			}
			startNavigation(() => {
				router.replace(url, { scroll: options?.scroll ?? false });
			});
		},
		[params, pathname, router, startNavigation],
	);

	return { params, searchParams, replace, pathname, isPending };
}

/** Skip URL→local sync until router.replace catches up (optimistic selection). */
export function syncAfterPendingUrl(pending: MutableRefObject<string | null>, urlValue: string | null): boolean {
	const expected = pending.current;
	if (expected === null) return true;
	if (urlValue === expected) {
		pending.current = null;
		return true;
	}
	return false;
}
