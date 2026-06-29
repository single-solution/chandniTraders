"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { classNames } from "@store/shared";
import { SelectSearchInput } from "./SelectSearchInput";
import type { SelectSearchOption } from "./filterSelectOptions";
import { useSelectSearch } from "./useSelectSearch";

export interface SearchableSelectPanelOption extends SelectSearchOption {
	count?: number;
}

interface SearchableSelectPanelProps {
	options: readonly SearchableSelectPanelOption[];
	value: string;
	onSelect: (value: string) => void;
	isOpen?: boolean;
	emptyMessage?: string;
	noResultsMessage?: string;
	searchPlaceholder?: string;
	singleSelectStyle?: "radio" | "check";
	className?: string;
	listClassName?: string;
	renderOptionLabel?: (option: SearchableSelectPanelOption) => ReactNode;
}

/** Searchable single-select list — shared by admin forms, filters, and storefront panels. */
export function SearchableSelectPanel({
	options,
	value,
	onSelect,
	isOpen = true,
	emptyMessage = "No options available.",
	noResultsMessage = "No matches found.",
	searchPlaceholder = "Search…",
	singleSelectStyle = "radio",
	className,
	listClassName,
	renderOptionLabel,
}: SearchableSelectPanelProps) {
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
						const isSelected = option.value === value;
						return (
							<button
								key={option.value}
								type="button"
								role="option"
								aria-selected={isSelected}
								onClick={() => onSelect(option.value)}
								className={classNames(
									"flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
									singleSelectStyle === "radio" ? "whitespace-nowrap" : null,
									isSelected
										? "bg-[var(--color-accent-50)] font-semibold text-[var(--color-accent-900)]"
										: "text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
								)}
							>
								<span
									aria-hidden
									className={classNames(
										"grid size-3.5 shrink-0 place-items-center border transition-colors",
										singleSelectStyle === "radio" ? "rounded-full" : "rounded-[var(--radius-sm)]",
										isSelected ? "border-[var(--color-accent-700)] bg-[var(--color-accent-700)] text-white" : "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
									)}
								>
									{isSelected ? singleSelectStyle === "radio" ? <span className="size-1.5 rounded-full bg-white" /> : <Check size={8} strokeWidth={3} /> : null}
								</span>
								<span className={singleSelectStyle === "radio" ? "whitespace-nowrap" : "min-w-0 flex-1 truncate"}>
									{renderOptionLabel ? renderOptionLabel(option) : option.label}
								</span>
								{typeof option.count === "number" ? <span className="ml-auto shrink-0 tabular-nums text-[10px] text-[var(--color-ink-400)]">{option.count}</span> : null}
								{isSelected && singleSelectStyle === "radio" ? <Check size={12} className="ml-auto shrink-0 text-[var(--color-accent-700)]" /> : null}
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
