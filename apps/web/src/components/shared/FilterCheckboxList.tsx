"use client";

import { SelectSearchInput, useSelectSearch } from "@store/ui";

import { FilterCheckRow } from "@/components/shared/FilterCheckRow";

export interface FilterCheckboxOption {
	value: string;
	label: string;
	count?: number;
}

interface FilterCheckboxListProps {
	options: FilterCheckboxOption[];
	selected: readonly string[];
	onToggle: (value: string) => void;
	compact?: boolean;
}

/** Checkbox filter list with search on every select panel. */
export function FilterCheckboxList({ options, selected, onToggle, compact = false }: FilterCheckboxListProps) {
	const { query, setQuery, filteredOptions } = useSelectSearch({
		options,
		isOpen: true,
	});

	return (
		<>
			<div className="mb-1">
				<SelectSearchInput value={query} onChange={setQuery} className="border-none px-0 py-0" />
			</div>
			<div className="space-y-0.5">
				{filteredOptions.length === 0 ? (
					<p className="px-2 text-[12px] text-[var(--color-ink-500)]">No matches found.</p>
				) : (
					filteredOptions.map((option) => (
						<FilterCheckRow
							key={option.value}
							label={option.label}
							count={option.count}
							checked={selected.includes(option.value)}
							onToggle={() => onToggle(option.value)}
							compact={compact}
						/>
					))
				)}
			</div>
		</>
	);
}
