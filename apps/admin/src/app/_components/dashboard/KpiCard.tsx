import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { classNames } from "@store/shared";

type KpiTone = "default" | "accent" | "info" | "warn" | "danger";

interface KpiCardProps {
	label: string;
	value: string;
	changePercent?: number;
	changeLabel?: string;
	icon?: ReactNode;
	spark?: ReactNode;
	hint?: string;
	tone?: KpiTone;
}

// Card bodies stay neutral so the dashboard reads calm — only the single
// accent (headline Sales) tints its surface. Semantic tones (info/warn/
// danger) survive solely as a muted icon-badge tint, enough to signal
// "needs attention" without painting the whole grid in colour.
const TONE_CONTAINER: Record<KpiTone, string> = {
	default: "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
	accent: "border-[var(--color-accent-200)] bg-[var(--color-accent-50)]",
	info: "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
	warn: "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
	danger: "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
};

const TONE_ICON_BADGE: Record<KpiTone, string> = {
	default: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]",
	accent: "bg-[var(--color-accent-500)] text-[var(--color-ink-900)]",
	info: "bg-sky-500/10 text-sky-600",
	warn: "bg-amber-500/12 text-amber-700",
	danger: "bg-rose-500/12 text-rose-600",
};

export function KpiCard({ label, value, changePercent, changeLabel, icon, spark, hint, tone = "default" }: KpiCardProps) {
	const isPositive = (changePercent ?? 0) >= 0;
	return (
		<div
			title={hint || changeLabel || label}
			className={classNames(
				"group flex h-full flex-col justify-center px-4 py-4 transition-colors sm:px-5 sm:py-5",
				tone === "accent" ? "bg-[var(--color-accent-50)] hover:bg-[var(--color-accent-100)]/60" : "bg-[var(--color-surface)] hover:bg-[var(--color-canvas-deep)]/50",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<p className="text-[13px] font-medium text-[var(--color-ink-600)] transition-colors group-hover:text-[var(--color-ink-900)]">{label}</p>
				{Boolean(icon) && (
					<span
						className={classNames(
							"text-[var(--color-ink-400)] transition-colors group-hover:text-[var(--color-ink-600)]",
							tone === "accent" && "text-[var(--color-accent-700)] group-hover:text-[var(--color-accent-800)]",
						)}
					>
						{icon}
					</span>
				)}
			</div>
			<div className="mt-3 flex items-end justify-between gap-2">
				<div>
					<p className="text-[24px] font-semibold leading-none tracking-tight text-[var(--color-ink-900)] sm:text-[28px]">{value}</p>
					{typeof changePercent === "number" && (
						<p className={classNames("mt-2 flex items-center gap-0.5 text-[11.5px] font-semibold", isPositive ? "text-[var(--color-accent-700)]" : "text-rose-600")}>
							{isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
							{Math.abs(changePercent)}%
						</p>
					)}
				</div>
				{Boolean(spark) && <div className="shrink-0 pb-1 opacity-90 transition-opacity group-hover:opacity-100">{spark}</div>}
			</div>
		</div>
	);
}
