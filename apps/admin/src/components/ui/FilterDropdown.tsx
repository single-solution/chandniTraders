"use client";

import { useRef, useState, type MouseEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { SearchableMultiSelectPanel, SearchableSelectPanel } from "@store/ui";
import { classNames } from "@store/shared";
import { Popover } from "@/components/ui/Popover";

export interface FilterOption {
	value: string;
	label: string;
	count?: number;
}

interface FilterDropdownProps {
	label: string;
	options: FilterOption[];
	selected: string[];
	onChange: (next: string[]) => void;
	/** When true the popover behaves like a radio group (one value at a time). */
	single?: boolean;
	disabled?: boolean;
	className?: string;
}

/**
 * Universal Filter Dropdown Component (Standard)
 *
 * Compact admin list-filter dropdown used in list views and tables.
 * Search appears automatically when six or more options are available.
 */
export function FilterDropdown({ label, options, selected, onChange, single, disabled, className }: FilterDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const activeCount = selected.length;
	const isActive = activeCount > 0;
	const isDisabled = disabled || options.length === 0;

	function toggle(value: string) {
		if (single) {
			onChange([value]);
			setIsOpen(false);
			return;
		}
		if (selected.includes(value)) {
			onChange(selected.filter((entry) => entry !== value));
		} else {
			onChange([...selected, value]);
		}
	}

	function clear(event: MouseEvent) {
		event.stopPropagation();
		onChange([]);
		setIsOpen(false);
	}

	const singleSelectedLabel = single && activeCount === 1 ? options.find((option) => option.value === selected[0])?.label : undefined;

	const triggerLabel = singleSelectedLabel ? `${label}: ${singleSelectedLabel}` : isActive ? `${label} · ${activeCount}` : label;

	return (
		<div className={classNames("relative", className)} ref={containerRef}>
			<button
				type="button"
				disabled={isDisabled}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				onClick={() => setIsOpen((prev) => !prev)}
				className={classNames(
					"inline-flex max-w-[14rem] items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors",
					isDisabled
						? "cursor-not-allowed border border-[var(--color-ink-100)] bg-[var(--color-canvas)] text-[var(--color-ink-300)]"
						: isActive
							? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] hover:bg-[var(--color-accent-200)]"
							: "border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:border-[var(--color-ink-300)] hover:text-[var(--color-ink-900)]",
				)}
			>
				<span className="truncate">{triggerLabel}</span>
				{isActive ? (
					<span
						role="button"
						tabIndex={0}
						aria-label={`Clear ${label} filter`}
						onClick={clear}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								clear(event as unknown as MouseEvent);
							}
						}}
						className="grid size-3.5 shrink-0 place-items-center rounded-full text-[var(--color-accent-700)] hover:bg-[var(--color-accent-200)]"
					>
						<X size={10} />
					</span>
				) : (
					<ChevronDown size={11} className={classNames("shrink-0 transition-transform", isOpen && "rotate-180")} />
				)}
			</button>
			<Popover
				isOpen={isOpen}
				anchorRef={containerRef}
				onRequestClose={() => setIsOpen(false)}
				align="left"
				role="listbox"
				className="animate-popover-in min-w-[12rem] max-w-[18rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]"
			>
				{single ? (
					<SearchableSelectPanel options={options} value={selected[0] ?? ""} onSelect={toggle} isOpen={isOpen} emptyMessage="Nothing to filter." singleSelectStyle="radio" />
				) : (
					<SearchableMultiSelectPanel options={options} selectedValues={selected} onToggle={toggle} isOpen={isOpen} emptyMessage="Nothing to filter." />
				)}
				{!single && activeCount > 0 ? (
					<div className="border-t border-[var(--color-ink-100)] px-3 py-1.5 text-right">
						<button type="button" onClick={clear} className="text-[10px] font-semibold text-[var(--color-accent-700)] hover:underline">
							Clear ({activeCount})
						</button>
					</div>
				) : null}
			</Popover>
		</div>
	);
}
