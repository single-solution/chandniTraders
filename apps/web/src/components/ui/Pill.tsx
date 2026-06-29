import type { ReactNode } from "react";
import { classNames } from "@store/shared";

type PillTone = "neutral" | "accent" | "warn" | "danger" | "info" | "dark" | "outline";
type PillSize = "sm" | "md";

interface PillProps {
	tone?: PillTone;
	size?: PillSize;
	leadingIcon?: ReactNode;
	className?: string;
	children: ReactNode;
}

const TONE_CLASSES: Record<PillTone, string> = {
	neutral: "bg-[var(--color-ink-100)] text-[var(--color-ink-800)]",
	accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]",
	warn: "bg-[var(--color-warn-100)] text-[var(--color-warn-800)]",
	danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-800)]",
	info: "bg-[var(--color-info-100)] text-[var(--color-info-800)]",
	dark: "bg-[var(--color-ink-900)] text-[var(--color-on-dark)] shadow-[var(--shadow-sm)]",
	outline: "border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)]",
};

const SIZE_CLASSES: Record<PillSize, string> = {
	sm: "h-6 px-2.5 text-[11px] gap-1",
	md: "h-7 px-3 text-xs gap-1.5",
};

export function Pill({ tone = "neutral", size = "md", leadingIcon, className, children }: PillProps) {
	return (
		<span
			className={classNames(
				"inline-flex items-center rounded-[var(--radius-full)] font-medium tracking-tight leading-none whitespace-nowrap",
				TONE_CLASSES[tone],
				SIZE_CLASSES[size],
				className,
			)}
		>
			{leadingIcon}
			<span>{children}</span>
		</span>
	);
}
