"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { categoryHref } from "@/lib/catalog/productPaths";
import { useCategories, useShopHref } from "@/lib/core/storefrontReferenceContext";
import { prefetchAllowed } from "@/lib/navigation/prefetchAllowed";

const MAX_CATEGORY_PREFETCH = 5;

/** Warm router cache for routes not covered by in-viewport `<Link prefetch>`. */
export function IdleRoutePrefetch() {
	const router = useRouter();
	const catalogHomeHref = useShopHref();
	const categories = useCategories();

	const routes = useMemo(() => {
		const categoryRoutes = categories
			.filter((category) => category.isActive)
			.slice(0, MAX_CATEGORY_PREFETCH)
			.map((category) => categoryHref(category.slug));

		return [...new Set([catalogHomeHref, "/deals", "/about", "/cart", ...categoryRoutes])];
	}, [catalogHomeHref, categories]);

	useEffect(() => {
		if (!prefetchAllowed()) {
			return;
		}

		const run = () => {
			for (const route of routes) {
				try {
					router.prefetch(route);
				} catch {
					// ignore — bad URL or duplicate prefetch.
				}
			}
		};

		const supportsIdle = typeof window.requestIdleCallback === "function";
		if (supportsIdle) {
			const handle = window.requestIdleCallback(run, { timeout: 3000 });
			return () => window.cancelIdleCallback(handle);
		}

		const handle = window.setTimeout(run, 1500);
		return () => window.clearTimeout(handle);
	}, [router, routes]);

	return null;
}
