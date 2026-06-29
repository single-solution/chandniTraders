"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { classNames } from "@store/shared";
import { SelectSearchInput } from "./SelectSearchInput";
import type { SelectSearchOption } from "./filterSelectOptions";
import { useSelectSearch } from "./useSelectSearch";

export interface SearchableMultiSelectOption extends SelectSearchOption {
	count?: number;
}

interface SearchableMultiSelectPanelProps {
	options: readonly SearchableMultiSelectOption[];
	selectedValues: readonly string[];
	onToggle: (value: string) => void;
	isOpen?: boolean;
	emptyMessage?: string;
	noResultsMessage?: string;
	searchPlaceholder?: string;
	className?: string;
	listClassName?: string;
	renderOptionLabel?: (option: SearchableMultiSelectOption) => ReactNode;
}

/** Searchable multi-select list — shared by admin filter dropdowns and storefront filters. */
export function SearchableMultiSelectPanel({
	options,
	selectedValues,
	onToggle,
	isOpen = true,
	emptyMessage = "No options available.",
	noResultsMessage = "No matches found.",
	searchPlaceholder = "Search…",
	className,
	listClassName,
	renderOptionLabel,
}: SearchableMultiSelectPanelProps) {
	const { query, setQuery, showSearch, filteredOptions } = useSelectSearch({
		options,
		isOpen,
	});

	return (
		<div className={className}>
			{showSearch ? <SelectSearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} autoFocus /> : null}
			<div className={classNames("max-h-64 overflow-y-auto", listClassName)}>
				{options.length === 0 ? (
					<p className="px-3 py-2 text-[11px] text-[var(--color-ink-400)]">{emptyMessage}</p>
				) : filteredOptions.length === 0 ? (
					<p className="px-3 py-2 text-[11px] text-[var(--color-ink-400)]">{noResultsMessage}</p>
				) : (
					filteredOptions.map((option) => {
						const isSelected = selectedValues.includes(option.value);
						return (
							<button
								key={option.value}
								type="button"
								role="option"
								aria-selected={isSelected}
								onClick={() => onToggle(option.value)}
								className={classNames(
									"flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
									isSelected
										? "bg-[var(--color-accent-50)] font-semibold text-[var(--color-accent-900)]"
										: "text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
								)}
							>
								<span
									aria-hidden
									className={classNames(
										"grid size-3.5 shrink-0 place-items-center rounded-[var(--radius-sm)] border transition-colors",
										isSelected ? "border-[var(--color-accent-700)] bg-[var(--color-accent-700)] text-white" : "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
									)}
								>
									{isSelected ? <Check size={8} strokeWidth={3} /> : null}
								</span>
								<span className="min-w-0 flex-1 truncate">{renderOptionLabel ? renderOptionLabel(option) : option.label}</span>
								{typeof option.count === "number" ? <span className="shrink-0 tabular-nums text-[10px] text-[var(--color-ink-400)]">{option.count}</span> : null}
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
