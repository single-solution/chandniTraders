export const SELECT_SEARCH_MIN_OPTIONS = 0;

export interface SelectSearchOption {
	value: string;
	label: string;
}

/** Case-insensitive label filter for select / dropdown option lists. */
export function filterSelectOptions<T extends SelectSearchOption>(options: readonly T[], query: string): T[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [...options];
	}
	return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
}
