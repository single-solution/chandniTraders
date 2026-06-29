"use client";

/**
 * Forces the window to the top whenever the shop URL changes — covers
 * category swaps (pathname change) and filter / pagination changes
 * (query string change). The filter sidebar updates the URL via
 * `router.replace(..., { scroll: false })`, so Next.js never restores
 * scroll on its own; the user would otherwise stay mid-list while a
 * fresh product set streams in above them.
 */

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ShopScrollReset() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryKey = searchParams?.toString() ?? "";

	useLayoutEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [pathname, queryKey]);

	return null;
}
