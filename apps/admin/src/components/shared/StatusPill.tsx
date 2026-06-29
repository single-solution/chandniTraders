import type { ReactNode } from "react";
import { classNames } from "@store/shared";

export type StatusTone = "neutral" | "info" | "success" | "warn" | "danger" | "accent" | "dark";

interface StatusPillProps {
	tone?: StatusTone;
	children: ReactNode;
	leadingIcon?: ReactNode;
	className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)] border border-[var(--color-ink-100)]",
	info: "bg-sky-50 text-sky-800 border border-sky-100",
	success: "bg-[var(--color-success-50)] text-[var(--color-success-800)] border border-[var(--color-success-100)]",
	warn: "bg-amber-50 text-amber-800 border border-amber-100",
	danger: "bg-rose-50 text-rose-800 border border-rose-100",
	accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] border border-[var(--color-accent-200)]",
	dark: "bg-[var(--color-ink-900)] text-white border border-[var(--color-ink-900)]",
};

export function StatusPill({ tone = "neutral", children, leadingIcon, className }: StatusPillProps) {
	return (
		<span className={classNames("inline-flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5 text-[11px] font-semibold tracking-tight", TONE_CLASSES[tone], className)}>
			{leadingIcon}
			{children}
		</span>
	);
}
