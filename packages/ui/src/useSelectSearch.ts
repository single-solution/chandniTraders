"use client";

import { useEffect, useMemo, useState } from "react";
import { SELECT_SEARCH_MIN_OPTIONS, filterSelectOptions, type SelectSearchOption } from "./filterSelectOptions";

interface UseSelectSearchOptions<T extends SelectSearchOption> {
	options: readonly T[];
	minOptions?: number;
	isOpen?: boolean;
}

export function useSelectSearch<T extends SelectSearchOption>({ options, minOptions = SELECT_SEARCH_MIN_OPTIONS, isOpen = true }: UseSelectSearchOptions<T>) {
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (!isOpen) {
			setQuery("");
		}
	}, [isOpen]);

	const showSearch = minOptions <= 0 ? true : options.length >= minOptions;
	const filteredOptions = useMemo(() => filterSelectOptions(options, query), [options, query]);

	return {
		query,
		setQuery,
		showSearch,
		filteredOptions,
	};
}
