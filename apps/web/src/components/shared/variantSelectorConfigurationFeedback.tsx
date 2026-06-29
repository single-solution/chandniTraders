"use client";

import { Info, Sparkles } from "lucide-react";

interface ConfigurationSummaryBarProps {
	summary: string;
}

export function ConfigurationSummaryBar({ summary }: ConfigurationSummaryBarProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			className="animate-config-card-pop rounded-[var(--radius-lg)] border border-[var(--color-accent-300)] bg-gradient-to-br from-[var(--color-accent-100)] via-[var(--color-accent-50)] to-[var(--color-surface)] px-3 py-2.5 shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] md:px-3.5 md:py-3"
		>
			<div className="flex items-start gap-2">
				<Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--color-accent-700)]" aria-hidden />
				<div className="min-w-0">
					<p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-800)] md:text-[10px]">You have selected</p>
					<p className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--color-ink-900)] md:text-sm">{summary}</p>
				</div>
			</div>
		</div>
	);
}

interface ConfigurationRealignmentNoticeProps {
	message: string;
}

export function ConfigurationRealignmentNotice({ message }: ConfigurationRealignmentNoticeProps) {
	return (
		<div
			role="status"
			aria-live="assertive"
			className="animate-config-card-pop flex gap-2 rounded-[var(--radius-lg)] border border-[var(--color-ink-700)] bg-[var(--color-ink-800)] px-3 py-2.5 text-[11px] leading-snug text-[var(--color-accent-100)] shadow-[var(--shadow-md)] md:px-3.5 md:py-3 md:text-[12px]"
		>
			<Info size={15} className="mt-0.5 shrink-0 text-[var(--color-accent-400)]" aria-hidden />
			<p>{message}</p>
		</div>
	);
}
