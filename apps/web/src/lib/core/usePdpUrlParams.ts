"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

/**
 * PDP configurator URL sync. Uses `history.replaceState` — not
 * without refetching the RSC page (which caused gallery flicker).
 */
export function usePdpUrlParams() {
	const pathname = usePathname();
	const serverSearchParams = useSearchParams();
	const serverQuery = serverSearchParams?.toString() ?? "";

	const [params, setParams] = useState(() => new URLSearchParams(serverQuery));

	useEffect(() => {
		scheduleStateUpdate(() => {
			setParams(new URLSearchParams(serverQuery));
		});
	}, [pathname, serverQuery]);

	useEffect(() => {
		function onPopState() {
			setParams(new URLSearchParams(window.location.search.replace(/^\?/, "")));
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const replace = useCallback(
		(patch: Record<string, string | null | undefined>) => {
			setParams((previous) => {
				const next = new URLSearchParams(previous.toString());
				for (const [key, value] of Object.entries(patch)) {
					if (value === null || value === undefined || value === "") {
						next.delete(key);
					} else {
						next.set(key, String(value));
					}
				}
				const query = next.toString();
				const url = query ? `${pathname}?${query}` : pathname;
				window.history.replaceState(window.history.state, "", url);
				return next;
			});
		},
		[pathname],
	);

	return { params, searchParams: params, replace };
}
