"use client";

import { Search } from "lucide-react";
import { classNames } from "@store/shared";

interface SelectSearchInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
}

/** Compact search field for select / filter dropdown panels. */
export function SelectSearchInput({ value, onChange, placeholder = "Search…", className, autoFocus = false }: SelectSearchInputProps) {
	return (
		<div className={classNames("border-b border-[var(--color-ink-100)] px-2 py-1.5", className)}>
			<label className="relative flex items-center">
				<Search size={13} className="pointer-events-none absolute left-2 text-[var(--color-ink-400)]" />
				<input
					type="search"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					autoFocus={autoFocus}
					className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)] pl-7 pr-2 text-[12px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)]"
				/>
			</label>
		</div>
	);
}
