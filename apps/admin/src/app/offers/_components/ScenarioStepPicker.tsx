"use client";

import { useRef, useState, type MouseEvent } from "react";

import { ChevronDown, X } from "lucide-react";

import { SearchableSelectPanel } from "@store/ui";

import { classNames } from "@store/shared";

import { Popover } from "@/components/ui/Popover";

interface ScenarioStepOption {
	value: string;

	label: string;
}

interface ScenarioStepPickerProps {
	label: string;

	options: ScenarioStepOption[];

	value: string;

	onChange: (value: string) => void;

	placeholder?: string;

	disabled?: boolean;

	optional?: boolean;
}

/** Single-select pill picker — full labels, nowrap, width fits content. */

export function ScenarioStepPicker({
	label,

	options,

	value,

	onChange,

	placeholder = "Select…",

	disabled = false,

	optional = false,
}: ScenarioStepPickerProps) {
	const [isOpen, setIsOpen] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);

	const selectedLabel = options.find((option) => option.value === value)?.label;

	const isActive = Boolean(value);

	const isDisabled = disabled || options.length === 0;

	const triggerText = selectedLabel ?? placeholder;

	function clear(event: MouseEvent) {
		event.stopPropagation();

		onChange("");

		setIsOpen(false);
	}

	function pick(nextValue: string) {
		onChange(nextValue);

		setIsOpen(false);
	}

	return (
		<div ref={containerRef} className="flex shrink-0 flex-col gap-1.5">
			<span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
				{label}

				{optional ? <span className="ml-1 font-normal normal-case tracking-normal text-[var(--color-ink-400)]">(optional)</span> : null}
			</span>

			<button
				type="button"
				disabled={isDisabled}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				onClick={() => setIsOpen((open) => !open)}
				className={classNames(
					"inline-flex w-fit max-w-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",

					isDisabled
						? "cursor-not-allowed border-[var(--color-ink-100)] bg-[var(--color-canvas)] text-[var(--color-ink-300)]"
						: isActive
							? "border-[var(--color-accent-400)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)] hover:bg-[var(--color-accent-200)]"
							: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:border-[var(--color-ink-300)] hover:text-[var(--color-ink-900)]",
				)}
			>
				<span className="whitespace-nowrap">{triggerText}</span>

				{isActive ? (
					<span
						role="button"
						tabIndex={0}
						aria-label={`Clear ${label}`}
						onClick={clear}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();

								clear(event as unknown as MouseEvent);
							}
						}}
						className="grid size-4 shrink-0 place-items-center rounded-full text-[var(--color-accent-700)] hover:bg-[var(--color-accent-200)]"
					>
						<X size={10} />
					</span>
				) : (
					<ChevronDown size={12} className={classNames("shrink-0 transition-transform", isOpen && "rotate-180")} />
				)}
			</button>

			<Popover
				isOpen={isOpen}
				anchorRef={containerRef}
				onRequestClose={() => setIsOpen(false)}
				align="left"
				role="listbox"
				className="animate-popover-in w-max max-w-[min(90vw,28rem)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]"
			>
				<SearchableSelectPanel options={options} value={value} onSelect={pick} isOpen={isOpen} singleSelectStyle="radio" />
			</Popover>
		</div>
	);
}
