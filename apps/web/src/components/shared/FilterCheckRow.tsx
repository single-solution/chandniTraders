"use client";

import { Check } from "lucide-react";
import { classNames } from "@store/shared";

interface FilterCheckRowProps {
	label: string;
	count?: number;
	checked: boolean;
	onToggle: () => void;
	compact?: boolean;
}

export function FilterCheckRow({ label, count, checked, onToggle, compact = false }: FilterCheckRowProps) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={checked}
			className={classNames(
				"tap flex w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-md)] transition-all duration-300 ease-out-quart",
				compact ? "px-2 py-1 text-[13px]" : "gap-3 px-2.5 py-1.5 text-[14.5px]",
				checked
					? "bg-[var(--color-accent-100)] font-medium text-[var(--color-accent-800)]"
					: "font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
			)}
		>
			<span className={classNames("flex min-w-0 items-center", compact ? "gap-2" : "gap-3")}>
				<span
					aria-hidden
					className={classNames(
						"grid shrink-0 place-items-center rounded-[6px] border transition-colors",
						compact ? "size-[16px]" : "size-[20px]",
						checked ? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)] text-[var(--color-accent-800)]" : "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
					)}
				>
					{checked ? <Check size={compact ? 11 : 14} strokeWidth={3} className="animate-badge-pop" /> : null}
				</span>
				<span className="truncate">{label}</span>
			</span>
			{count !== undefined ? (
				<span className={classNames("shrink-0 tabular-nums", compact ? "text-[11px]" : "text-[12px]", checked ? "text-[var(--color-accent-700)]" : "text-[var(--color-ink-400)]")}>
					{count}
				</span>
			) : null}
		</button>
	);
}
