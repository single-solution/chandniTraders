/**
 * Tiny hook that gives client components a "live filters" view backed by
 * URL search params plus a `setParam`/`replaceParams` API that pushes the
 * change back into the URL — without losing scroll position. Centralises
 * the small `router.push` + `URLSearchParams` boilerplate so every filter
 * component looks the same.
 */
"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";

export function useFilterParams() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { isPending, startNavigation } = useNavigationTransition();

	const params = useMemo(() => {
		return new URLSearchParams(searchParams?.toString() ?? "");
	}, [searchParams]);

	const push = useCallback(
		(next: URLSearchParams, options: { resetPage?: boolean } = {}) => {
			if (options.resetPage !== false) {
				next.delete(FILTER_PARAM_KEYS.page);
			}
			const queryString = next.toString();
			const url = queryString ? `${pathname}?${queryString}` : pathname;
			startNavigation(() => {
				router.replace(url, { scroll: false });
			});
		},
		[pathname, router, startNavigation],
	);

	const setMulti = useCallback(
		(key: string, values: (string | number)[]) => {
			const next = new URLSearchParams(params.toString());
			if (values.length === 0) {
				next.delete(key);
			} else {
				next.set(key, values.map(String).join(","));
			}
			push(next);
		},
		[params, push],
	);

	const setSingle = useCallback(
		(key: string, value: string | number | null | undefined, options: { resetPage?: boolean } = {}) => {
			const next = new URLSearchParams(params.toString());
			if (value === null || value === undefined || value === "") {
				next.delete(key);
			} else {
				next.set(key, String(value));
			}
			push(next, options);
		},
		[params, push],
	);

	const toggleInMulti = useCallback(
		(key: string, value: string) => {
			const next = new URLSearchParams(params.toString());
			const current = (next.get(key) ?? "")
				.split(",")
				.map((token) => token.trim())
				.filter(Boolean);
			const set = new Set(current);
			if (set.has(value)) {
				set.delete(value);
			} else {
				set.add(value);
			}
			if (set.size === 0) {
				next.delete(key);
			} else {
				next.set(key, Array.from(set).join(","));
			}
			push(next);
		},
		[params, push],
	);

	const getMulti = useCallback(
		(key: string): string[] => {
			const raw = params.get(key);
			if (!raw) {
				return [];
			}
			return raw
				.split(",")
				.map((token) => token.trim())
				.filter(Boolean);
		},
		[params],
	);

	const getSingle = useCallback(
		(key: string): string | undefined => {
			return params.get(key) ?? undefined;
		},
		[params],
	);

	const clearAll = useCallback(() => {
		push(new URLSearchParams());
	}, [push]);

	const replaceParams = useCallback(
		(next: URLSearchParams, options: { resetPage?: boolean } = {}) => {
			push(next, options);
		},
		[push],
	);

	return {
		params,
		setMulti,
		setSingle,
		toggleInMulti,
		getMulti,
		getSingle,
		clearAll,
		replaceParams,
		isPending,
	};
}
