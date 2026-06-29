"use client";

import { classNames } from "@store/shared";

export interface AttributeOptionTab {
	key: string;
	label: string;
}

interface AttributeOptionTabRowProps {
	options: AttributeOptionTab[];
	/** Single-select: one key or undefined. Multi-select: pass all selected keys. */
	selectedKeys: string[];
	onSelect: (key: string) => void;
	ariaLabel: string;
	/** Last tab — e.g. product-only custom value (single-select flows). */
	trailingOption?: {
		key: string;
		label: string;
		isSelected: boolean;
		onSelect: () => void;
	};
}

const TAB_BASE =
	"flex flex-1 items-center justify-center whitespace-nowrap border-0 px-1.5 py-1.5 text-center text-[10px] font-medium leading-snug transition-all md:px-2 md:py-2 md:text-[11px]";

const TAB_SELECTED =
	"rounded-[var(--radius-sm)] bg-[var(--color-accent-50)] font-semibold text-[var(--color-accent-800)] shadow-[var(--shadow-sm)] ring-1 ring-inset ring-[var(--color-accent-500)]";

const TAB_IDLE = "bg-[var(--color-surface)] text-[var(--color-ink-800)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-800)]";

/** Matches storefront PDP `DimensionTabRow` segmented control. */
export function AttributeOptionTabRow({ options, selectedKeys, onSelect, ariaLabel, trailingOption }: AttributeOptionTabRowProps) {
	const selectedSet = new Set(selectedKeys);

	return (
		<div
			className="flex w-full divide-x divide-[var(--color-ink-200)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-200)]"
			role="tablist"
			aria-label={ariaLabel}
		>
			{options.map((option) => {
				const isSelected = selectedSet.has(option.key);
				return (
					<button
						key={option.key}
						type="button"
						role="tab"
						aria-selected={isSelected}
						onClick={() => onSelect(option.key)}
						className={classNames(TAB_BASE, isSelected ? TAB_SELECTED : TAB_IDLE)}
					>
						{option.label}
					</button>
				);
			})}
			{trailingOption ? (
				<button
					type="button"
					role="tab"
					aria-selected={trailingOption.isSelected}
					onClick={trailingOption.onSelect}
					className={classNames(
						TAB_BASE,
						trailingOption.isSelected
							? TAB_SELECTED
							: "border-dashed bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-800)]",
					)}
				>
					{trailingOption.label}
				</button>
			) : null}
		</div>
	);
}

export const ATTRIBUTE_DIMENSION_LABEL_CLASS = "text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)] md:text-[10.5px]";
