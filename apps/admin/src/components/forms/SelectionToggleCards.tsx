"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { classNames } from "@store/shared";

export interface SelectionToggleOption<T extends string> {
	value: T;
	title: string;
	description?: string;
	icon?: ReactNode;
}

interface SelectionToggleCardsProps<T extends string> {
	label?: string;
	hint?: string;
	value: T;
	options: ReadonlyArray<SelectionToggleOption<T>>;
	onChange: (value: T) => void;
	columns?: 2 | 3 | 4;
}

/** Single-select toggle cards — no native radios; matches admin pill/card selection patterns. */
export function SelectionToggleCards<T extends string>({ label, hint, value, options, onChange, columns = 2 }: SelectionToggleCardsProps<T>) {
	const columnClass = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

	return (
		<div className="flex flex-col gap-2">
			{label ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">{label}</p> : null}
			<div className={classNames("grid gap-3", columnClass)} role="group" aria-label={label}>
				{options.map((option) => {
					const isSelected = option.value === value;
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={isSelected}
							onClick={() => onChange(option.value)}
							className={classNames(
								"tap flex flex-col gap-1 rounded-[var(--radius-md)] border p-3 text-left transition-all",
								isSelected
									? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)] shadow-[var(--shadow-sm)]"
									: "border-[var(--color-ink-200)] bg-[var(--color-surface)] hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas)]",
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									{option.icon ? <span className="shrink-0 text-[var(--color-ink-500)]">{option.icon}</span> : null}
									<span className={classNames("text-[13px] tracking-tight text-[var(--color-ink-900)]", isSelected ? "font-bold" : "font-semibold")}>{option.title}</span>
								</div>
								{isSelected ? (
									<span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--color-accent-600)] text-white">
										<Check size={10} strokeWidth={3} aria-hidden />
									</span>
								) : null}
							</div>
							{option.description ? <p className="text-[11px] leading-snug text-[var(--color-ink-500)]">{option.description}</p> : null}
						</button>
					);
				})}
			</div>
			{hint ? <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p> : null}
		</div>
	);
}
