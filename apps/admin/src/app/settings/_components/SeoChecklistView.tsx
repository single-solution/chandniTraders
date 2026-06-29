"use client";

import { Check, Circle, Minus, X } from "lucide-react";

import { seoScoreTone, type SeoChecklistItem, type SeoChecklistResult, type SeoChecklistStatus } from "@store/shared";
import { classNames } from "@store/shared";

interface SeoChecklistViewProps {
	result: SeoChecklistResult;
}

export function StatusIcon({ status }: { status: SeoChecklistStatus }) {
	if (status === "pass") {
		return <Check size={14} className="text-emerald-600" />;
	}
	if (status === "warn") {
		return <Minus size={14} className="text-amber-600" />;
	}
	if (status === "fail") {
		return <X size={14} className="text-rose-600" />;
	}
	return <Circle size={14} className="text-[var(--color-ink-300)]" />;
}

export function rowTone(status: SeoChecklistStatus): string {
	switch (status) {
		case "pass":
			return "text-[var(--color-ink-800)]";
		case "warn":
			return "text-amber-800";
		case "fail":
			return "text-rose-800";
		default:
			return "text-[var(--color-ink-500)]";
	}
}

export function ChecklistRow({ item }: { item: SeoChecklistItem }) {
	return (
		<li className="flex items-start gap-2 text-xs">
			<span className="mt-0.5 shrink-0">
				<StatusIcon status={item.status} />
			</span>
			<span className={rowTone(item.status)}>{item.label}</span>
		</li>
	);
}

export function SeoChecklistView({ result }: SeoChecklistViewProps) {
	const tone = seoScoreTone(result.score);
	const scoreClass = tone === "success" ? "bg-emerald-100 text-emerald-800" : tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

	const genericItems = result.items.filter((item) => !item.id.startsWith("keyword-") && item.id !== "title-length" && item.id !== "description-length");

	return (
		<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/50 p-3">
			<div className={classNames("flex items-center justify-between gap-2", genericItems.length > 0 ? "mb-2" : "")}>
				<p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">Overall SEO Score</p>
				<span className={classNames("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", scoreClass)}>Score: {result.score}/100</span>
			</div>
			{genericItems.length > 0 && (
				<ul className="space-y-1.5">
					{genericItems.map((item) => (
						<ChecklistRow key={item.id} item={item} />
					))}
				</ul>
			)}
		</div>
	);
}
