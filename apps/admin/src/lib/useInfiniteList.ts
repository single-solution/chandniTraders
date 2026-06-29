/**
 * Server-paged "scroll to load more" state for the admin list workspaces.
 *
 * Mirrors the storefront `useInfiniteProducts` pattern (one shape across the
 * codebase): seeded with the SSR first page so navigation is flash-free, then
 * appends subsequent pages from the surface's list endpoint over the shared
 * `{ items, total, page, limit }` envelope. The accumulated list is de-duped
 * by id. A change to the listing identity (`paramsKey` — search + filters,
 * synced to the URL by the caller) resets back to the fresh SSR seed.
 *
 * When a fresh `initial` arrives for the *same* listing (e.g. a `router.refresh()`
 * after a mutation), the new server page is reconciled as the authoritative head
 * — adopting edits, new top rows, and an updated total — while any deeper pages
 * already loaded via `loadMore` are preserved as the tail. That lets the existing
 * `router.refresh()` calls reflect changes without dropping the loaded list or the
 * scroll position.
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { ListResponse } from "@/lib/api/listOptions";

interface UseInfiniteListArgs<TItem> {
	/** List endpoint base, e.g. `/api/orders`. */
	endpoint: string;
	/** SSR first page for the current params — the seed and reset target. */
	initial: ListResponse<TItem>;
	/**
	 * Query params (search + surface filters) that define the listing. Must be
	 * memoised by the caller so the loadMore callback and reset key stay stable
	 * across re-renders.
	 */
	params: Record<string, string>;
}

interface UseInfiniteListResult<TItem> {
	items: TItem[];
	total: number;
	hasMore: boolean;
	isLoadingMore: boolean;
	hasError: boolean;
	loadMore: () => void;
	/** Replace one item in place (optimistic updates) without a refetch. */
	patchItem: (id: string, patch: Partial<TItem>) => void;
	/** Drop one item from the loaded list (optimistic delete). */
	removeItem: (id: string) => void;
}

export function useInfiniteList<TItem extends { id: string }>({ endpoint, initial, params }: UseInfiniteListArgs<TItem>): UseInfiniteListResult<TItem> {
	const listKey = useMemo(() => stableKey(params), [params]);

	const [items, setItems] = useState<TItem[]>(initial.items);
	const [total, setTotal] = useState(initial.total);
	const [page, setPage] = useState(initial.page);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [seedKey, setSeedKey] = useState(listKey);

	const seenIdsRef = useRef<Set<string>>(new Set(initial.items.map((item) => item.id)));
	const isLoadingRef = useRef(false);
	const pageRef = useRef(page);
	const totalRef = useRef(total);
	const loadedRef = useRef(items.length);
	const limitRef = useRef(initial.limit);
	const initialRef = useRef(initial);

	if (seedKey !== listKey) {
		// Listing identity changed (filter/search) — reset to the fresh SSR seed.
		setSeedKey(listKey);
		setItems(initial.items);
		setTotal(initial.total);
		setPage(initial.page);
		setIsLoadingMore(false);
		setHasError(false);
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		seenIdsRef.current = new Set(initial.items.map((item) => item.id));
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		isLoadingRef.current = false;
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		limitRef.current = initial.limit;
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		initialRef.current = initial;
		// eslint-disable-next-line react-hooks/refs -- intentional sync read
	} else if (initialRef.current !== initial) {
		// Same listing, fresh server data (router.refresh after a mutation). Adopt
		// the new page as the head; keep already-loaded deeper pages as the tail.
		// eslint-disable-next-line react-hooks/refs -- intentional sync reset
		initialRef.current = initial;
		setItems((previous) => {
			const headIds = new Set(initial.items.map((item) => item.id));
			const tail = previous.filter((item) => !headIds.has(item.id));
			const merged = [...initial.items, ...tail];
			seenIdsRef.current = new Set(merged.map((item) => item.id));
			return merged;
		});
		setTotal(initial.total);
	}

	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	pageRef.current = page;
	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	totalRef.current = total;
	// eslint-disable-next-line react-hooks/refs -- intentional sync read
	loadedRef.current = items.length;

	const loadMore = useCallback(() => {
		if (isLoadingRef.current || loadedRef.current >= totalRef.current) {
			return;
		}
		isLoadingRef.current = true;
		setIsLoadingMore(true);
		setHasError(false);

		const nextPage = pageRef.current + 1;
		const query = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (value) {
				query.set(key, value);
			}
		}
		query.set("page", String(nextPage));
		query.set("limit", String(limitRef.current));

		void (async () => {
			try {
				const data = await apiFetch<ListResponse<TItem>>(`${endpoint}?${query.toString()}`);
				setItems((previous) => {
					const merged = previous.slice();
					for (const item of data.items) {
						if (!seenIdsRef.current.has(item.id)) {
							seenIdsRef.current.add(item.id);
							merged.push(item);
						}
					}
					return merged;
				});
				setPage(data.page);
				setTotal(data.total);
			} catch {
				setHasError(true);
			} finally {
				isLoadingRef.current = false;
				setIsLoadingMore(false);
			}
		})();
	}, [endpoint, params]);

	const patchItem = useCallback((id: string, patch: Partial<TItem>) => {
		setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	}, []);

	const removeItem = useCallback((id: string) => {
		seenIdsRef.current.delete(id);
		setItems((previous) => previous.filter((item) => item.id !== id));
		setTotal((previous) => Math.max(0, previous - 1));
	}, []);

	return {
		items,
		total,
		hasMore: items.length < total,
		isLoadingMore,
		hasError,
		loadMore,
		patchItem,
		removeItem,
	};
}

function stableKey(params: Record<string, string>): string {
	const sorted = new URLSearchParams();
	for (const key of Object.keys(params).sort()) {
		if (params[key]) {
			sorted.set(key, params[key]);
		}
	}
	return sorted.toString();
}
