"use client";

import { useRef, useState, type ChangeEvent, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { SearchableSelectPanel } from "@store/ui";
import { classNames } from "@store/shared";
import { Popover } from "@/components/ui/Popover";

interface SelectOption {
	value: string;
	label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
	label?: string;
	options: SelectOption[];
	hint?: string;
}

/** Searchable single-select — drop-in replacement for native `<select>` across admin forms. */
export function SelectField({ label, options, hint, id, className, value, onChange, disabled, required, name }: SelectFieldProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const fieldId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
	const selectedValue = String(value ?? "");
	const selectedLabel = options.find((option) => option.value === selectedValue)?.label;
	const isDisabled = disabled || options.length === 0;
	const triggerText = selectedLabel ?? options.find((option) => option.value === "")?.label ?? "Select…";

	function pick(nextValue: string) {
		onChange?.({ target: { value: nextValue } } as ChangeEvent<HTMLSelectElement>);
		setIsOpen(false);
	}

	return (
		<div ref={containerRef} className={classNames("reveal animate-in flex flex-col gap-1.5", className)}>
			{label ? (
				<label htmlFor={fieldId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
					{label}
				</label>
			) : null}
			<div className="relative flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-ink-300)] focus-within:border-[var(--color-accent-700)] focus-within:ring-2 focus-within:ring-[var(--color-accent-100)]">
				{required ? (
					<input
						tabIndex={-1}
						name={name}
						value={selectedValue}
						required={required}
						onChange={() => undefined}
						className="pointer-events-none absolute size-0 opacity-0"
						aria-hidden
					/>
				) : null}
				<button
					type="button"
					id={fieldId}
					disabled={isDisabled}
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					onClick={() => setIsOpen((open) => !open)}
					className={classNames(
						"flex h-full w-full items-center justify-between bg-transparent pl-3 pr-3 text-left text-[13px] text-[var(--color-ink-900)] focus:outline-none md:text-sm",
						isDisabled && "cursor-not-allowed text-[var(--color-ink-400)]",
					)}
				>
					<span className="truncate">{triggerText}</span>
					<ChevronDown size={14} className={classNames("shrink-0 text-[var(--color-ink-400)] transition-transform", isOpen && "rotate-180")} />
				</button>
			</div>
			{Boolean(hint) ? <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p> : null}
			<Popover
				isOpen={isOpen}
				anchorRef={containerRef}
				onRequestClose={() => setIsOpen(false)}
				align="left"
				role="listbox"
				className="animate-popover-in min-w-[var(--select-panel-width,12rem)] max-w-[min(90vw,24rem)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]"
			>
				<SearchableSelectPanel options={options} value={selectedValue} onSelect={pick} isOpen={isOpen} singleSelectStyle="radio" />
			</Popover>
		</div>
	);
}
