"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { classNames } from "@store/shared";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	hint?: string;
	errorText?: string;
	leadingIcon?: ReactNode;
	trailingAddon?: ReactNode;
	containerClassName?: string;
	/** Show reveal toggle for `type="password"`. Default true. */
	showPasswordToggle?: boolean;
}

export function TextField({
	label,
	hint,
	errorText,
	leadingIcon,
	trailingAddon,
	containerClassName,
	id,
	className,
	type,
	showPasswordToggle = true,
	...rest
}: TextFieldProps) {
	const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
	const isPasswordField = type === "password";
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const resolvedType = isPasswordField && isPasswordVisible ? "text" : type;

	return (
		<div className={classNames("reveal animate-in flex flex-col gap-1.5", containerClassName)}>
			<label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
				{label}
			</label>
			<div
				className={classNames(
					"flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-ink-300)] focus-within:border-[var(--color-accent-700)] focus-within:ring-2 focus-within:ring-[var(--color-accent-100)]",
					errorText && "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100",
				)}
			>
				{Boolean(leadingIcon) && <span className="shrink-0 text-[var(--color-ink-400)]">{leadingIcon}</span>}
				<input
					id={inputId}
					type={resolvedType}
					{...rest}
					className={classNames(
						"h-full min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:outline-none md:text-sm",
						className,
					)}
				/>
				{isPasswordField && showPasswordToggle ? (
					<button
						type="button"
						onClick={() => setIsPasswordVisible((current) => !current)}
						className="tap grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-ink-400)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-700)]"
						aria-label={isPasswordVisible ? "Hide password" : "Show password"}
						aria-pressed={isPasswordVisible}
						tabIndex={-1}
					>
						{isPasswordVisible ? <EyeOff size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}
					</button>
				) : null}
				{Boolean(trailingAddon) && <span className="shrink-0 text-xs font-medium text-[var(--color-ink-500)]">{trailingAddon}</span>}
			</div>
			{Boolean(hint || errorText) && <p className={classNames("text-[10.5px] md:text-[11px]", errorText ? "text-rose-600" : "text-[var(--color-ink-500)]")}>{errorText ?? hint}</p>}
		</div>
	);
}
