"use client";

/**
 * Forces the window to the top whenever a PDP is rendered. Mounted high
 * in the PDP tree so it runs before the user sees the page.
 *
 * Why this exists: Next's App Router preserves scroll position when soft-
 * navigating between two routes that share the same dynamic segment
 * (`/shop/[category]/[slug]` → `/shop/[category]/[slug]`). Without this,
 * a tap on a related product from mid-page would land on the next PDP
 * at the same scroll offset. The `usePathname` dependency ensures the
 * scroll runs on every PDP transition, not just the first mount.
 */

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export function PdpScrollReset() {
	const pathname = usePathname();

	useLayoutEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [pathname]);

	return null;
}
