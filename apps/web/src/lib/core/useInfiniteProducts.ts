/**
 * Client-side "scroll to load more" state for the storefront product feeds.
 *
 * Seeded with the SSR first page so the initial paint is identical to the
 * server render (SEO + no loading flash), then appends subsequent pages from
 * `GET /api/products` on demand. The accumulated list is de-duped by product
 * id (offset pagination over a recently-updated sort can repeat an item if a
 * record shifts between fetches). The furthest loaded page is reflected into
 * the URL via `history.replaceState` so a scrolled position is shareable
 * without ever triggering a navigation (which would tear down the list and
 * the reveal animations).
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import type { ProductPage } from "@/lib/core";
import type { Product } from "@store/shared";

interface UseInfiniteProductsArgs {
	/** SSR first page — the seed and the reset target on filter changes. */
	initial: ProductPage;
	/**
	 * Surface-specific query params the URL doesn't already carry (e.g.
	 * `{ category: slug }` for a category listing, `{ featured: "1" }` for
	 * deals). Merged on top of the live URL filter params for each fetch.
	 */
	apiParams: Record<string, string>;
}

interface UseInfiniteProductsResult {
	products: Product[];
	total: number;
	hasMore: boolean;
	isLoadingMore: boolean;
	hasError: boolean;
	loadMore: () => void;
}

export function useInfiniteProducts({ initial, apiParams }: UseInfiniteProductsArgs): UseInfiniteProductsResult {
	const searchParams = useSearchParams();

	const filterKey = useMemo(() => buildFilterKey(searchParams?.toString() ?? "", apiParams), [searchParams, apiParams]);

	const [products, setProducts] = useState<Product[]>(initial.products);
	const [page, setPage] = useState(initial.page);
	const [pageCount, setPageCount] = useState(initial.pageCount);
	const [pageSize, setPageSize] = useState(initial.pageSize);
	const [total, setTotal] = useState(initial.total);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [seedKey, setSeedKey] = useState(filterKey);

	const seenIdsRef = useRef<Set<string>>(new Set(initial.products.map((product) => product.id)));
	const isLoadingRef = useRef(false);
	const pageRef = useRef(page);
	const pageCountRef = useRef(pageCount);
	const pageSizeRef = useRef(pageSize);

	// Reset to the fresh SSR seed when the listing identity changes (a filter
	// or search change re-renders the server page and hands us a new `initial`).
	// Render-phase state sync is React's blessed alternative to a reset effect.
	if (seedKey !== filterKey) {
		setSeedKey(filterKey);
		setProducts(initial.products);
		setPage(initial.page);
		setPageCount(initial.pageCount);
		setPageSize(initial.pageSize);
		setTotal(initial.total);
		setIsLoadingMore(false);
		setHasError(false);
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		seenIdsRef.current = new Set(initial.products.map((product) => product.id));
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		isLoadingRef.current = false;
	}

	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	pageRef.current = page;
	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	pageCountRef.current = pageCount;
	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	pageSizeRef.current = pageSize;

	const loadMore = useCallback(() => {
		if (isLoadingRef.current || pageRef.current >= pageCountRef.current) {
			return;
		}
		isLoadingRef.current = true;
		setIsLoadingMore(true);
		setHasError(false);

		const nextPage = pageRef.current + 1;
		const url = buildProductsUrl(searchParams?.toString() ?? "", apiParams, nextPage, pageSizeRef.current);

		void (async () => {
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`products request failed: ${response.status}`);
				}
				const data = (await response.json()) as ProductPage;

				setProducts((previous) => {
					const merged = previous.slice();
					for (const product of data.products) {
						if (!seenIdsRef.current.has(product.id)) {
							seenIdsRef.current.add(product.id);
							merged.push(product);
						}
					}
					return merged;
				});
				setPage(data.page);
				setPageCount(data.pageCount);
				setTotal(data.total);
				syncFurthestPageParam(data.page);
			} catch {
				setHasError(true);
			} finally {
				isLoadingRef.current = false;
				setIsLoadingMore(false);
			}
		})();
	}, [searchParams, apiParams]);

	return {
		products,
		total,
		hasMore: page < pageCount,
		isLoadingMore,
		hasError,
		loadMore,
	};
}

/** Listing identity for reset detection — every filter axis except page. */
function buildFilterKey(searchQuery: string, apiParams: Record<string, string>): string {
	const params = new URLSearchParams(searchQuery);
	params.delete(FILTER_PARAM_KEYS.page);
	for (const [key, value] of Object.entries(apiParams)) {
		params.set(key, value);
	}
	params.sort();
	return params.toString();
}

function buildProductsUrl(searchQuery: string, apiParams: Record<string, string>, page: number, pageSize: number): string {
	const params = new URLSearchParams(searchQuery);
	params.delete(FILTER_PARAM_KEYS.page);
	for (const [key, value] of Object.entries(apiParams)) {
		params.set(key, value);
	}
	params.set(FILTER_PARAM_KEYS.page, String(page));
	params.set("limit", String(pageSize));
	return `/api/products?${params.toString()}`;
}

/**
 * Mirror the furthest loaded page into the URL without a navigation, so the
 * scrolled position is shareable. `history.replaceState` deliberately does
 * not trip Next's `useSearchParams`, so the RSC tree and `RevealRoot` stay
 * mounted.
 */
function syncFurthestPageParam(page: number): void {
	if (typeof window === "undefined") {
		return;
	}
	const url = new URL(window.location.href);
	if (page <= 1) {
		url.searchParams.delete(FILTER_PARAM_KEYS.page);
	} else {
		url.searchParams.set(FILTER_PARAM_KEYS.page, String(page));
	}
	window.history.replaceState(window.history.state, "", url.toString());
}
