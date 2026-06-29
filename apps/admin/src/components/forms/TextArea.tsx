import type { TextareaHTMLAttributes } from "react";
import { classNames } from "@store/shared";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label: string;
	hint?: string;
	containerClassName?: string;
}

export function TextArea({ label, hint, id, className, containerClassName, rows = 4, ...rest }: TextAreaProps) {
	const fieldId = id ?? `area-${label.toLowerCase().replace(/\s+/g, "-")}`;
	return (
		<div className={classNames("reveal animate-in flex flex-col gap-1.5", containerClassName)}>
			<label htmlFor={fieldId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
				{label}
			</label>
			<textarea
				id={fieldId}
				rows={rows}
				{...rest}
				className={classNames(
					"rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-ink-300)] focus:border-[var(--color-accent-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] md:text-sm",
					className,
				)}
			/>
			{Boolean(hint) && <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p>}
		</div>
	);
}
