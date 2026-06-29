"use client";

import { classNames } from "@store/shared";

export interface ToggleProps {
	checked: boolean;
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	isLoading?: boolean;
	"aria-label"?: string;
	className?: string;
}

/**
 * Universal Toggle Component (Standard)
 *
 * MUST BE USED for all switch/toggle buttons across the application to ensure
 * visual consistency.
 *
 * Use this directly for inline toggles (e.g. inside table cells).
 * For form fields with labels and descriptions inside a bordered card, use `Switch` from `@/components/forms/Switch`.
 */
export function Toggle({ checked, onCheckedChange, disabled = false, isLoading = false, "aria-label": ariaLabel, className }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled || isLoading}
			onClick={() => onCheckedChange?.(!checked)}
			className={classNames(
				"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
				isLoading ? "cursor-wait opacity-60" : disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
				checked ? "bg-[var(--color-ink-900)]" : "bg-[var(--color-ink-200)]",
				className,
			)}
		>
			<span className={classNames("absolute size-4 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
		</button>
	);
}
