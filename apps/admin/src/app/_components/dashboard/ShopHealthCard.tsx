import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { classNames } from "@store/shared";

import type { ShopHealthCheck, ShopHealthSeverity, ShopHealthSummary } from "@/lib/server/shopHealth";

const SEVERITY_TONE: Record<ShopHealthSeverity, { row: string; pill: string; icon: typeof AlertTriangle }> = {
	error: {
		row: "border-rose-200 bg-rose-50/70",
		pill: "bg-rose-500/15 text-rose-700",
		icon: AlertTriangle,
	},
	warn: {
		row: "border-amber-200 bg-amber-50/60",
		pill: "bg-amber-500/15 text-amber-800",
		icon: AlertTriangle,
	},
	info: {
		row: "border-[var(--color-ink-100)] bg-[var(--color-canvas)]",
		pill: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-600)]",
		icon: Info,
	},
};

const HEADER_TONE: Record<ShopHealthSeverity, string> = {
	error: "text-rose-900 border-rose-200",
	warn: "text-amber-900 border-amber-200",
	info: "text-sky-900 border-sky-200",
};

const HEADER_TONE_BADGE: Record<ShopHealthSeverity, string> = {
	error: "bg-rose-500 text-white",
	warn: "bg-amber-500 text-white",
	info: "bg-sky-500 text-white",
};

const PREVIEW_LIMIT = 4;

export function ShopHealthCard({ summary }: { summary: ShopHealthSummary }) {
	if (summary.allClear) {
		return (
			<div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-emerald-500 bg-[var(--color-surface)] px-4 py-3 md:px-5 md:py-4 transition-colors hover:bg-[var(--color-canvas-deep)]">
				<div className="flex items-center gap-3">
					<span className="text-emerald-600">
						<CheckCircle2 size={16} />
					</span>
					<div className="leading-tight">
						<p className="text-[13px] font-semibold text-[var(--color-ink-900)] md:text-sm">Shop is in great shape</p>
						<p className="mt-0.5 text-[11px] text-[var(--color-ink-500)] md:text-[11.5px]">Catalog, payments, and storefront settings all check out.</p>
					</div>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
					<ShieldCheck size={11} /> All clear
				</span>
			</div>
		);
	}

	const worst = summary.worstSeverity ?? "info";
	const previewChecks = summary.checks.slice(0, PREVIEW_LIMIT);
	const remaining = summary.total - previewChecks.length;

	return (
		<section
			title={summary.allClear ? "Shop is in great shape" : `${summary.total} health checks need attention`}
			className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
		>
			<header className={classNames("flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 md:px-5 bg-[var(--color-canvas-deep)]")}>
				<div className="flex items-center gap-2">
					<ShieldCheck size={14} className="text-[var(--color-ink-600)]" aria-hidden />
					<p className="text-[13px] font-semibold md:text-sm">Shop health</p>
					<span className={classNames("inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none", HEADER_TONE_BADGE[worst])}>
						{summary.total}
					</span>
				</div>
				<Link
					href="/settings?tab=integrations"
					className="tap inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
				>
					View details <ArrowRight size={11} />
				</Link>
			</header>
			<ul className="reveal-stagger divide-y divide-[var(--color-ink-100)]">
				{previewChecks.map((check) => (
					<ShopHealthRow key={check.id} check={check} />
				))}
			</ul>
			{remaining > 0 ? (
				<div className="flex items-center justify-between gap-2 border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-4 py-2 md:px-5">
					<p className="text-[11px] text-[var(--color-ink-600)] md:text-[11.5px]">{remaining === 1 ? "1 more thing to review" : `${remaining} more things to review`}</p>
					<Link href="/settings?tab=integrations" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]">
						Review all <ArrowRight size={11} />
					</Link>
				</div>
			) : null}
		</section>
	);
}

function ShopHealthRow({ check }: { check: ShopHealthCheck }) {
	const tone = SEVERITY_TONE[check.severity];
	const Icon = tone.icon;
	const content = (
		<div
			title={check.description}
			className={classNames("reveal flex items-center gap-3 px-4 py-3 md:px-5", Boolean(check.href) && "transition-colors hover:bg-[var(--color-canvas-deep)]")}
		>
			<span className={classNames("grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)]", tone.pill)} aria-hidden>
				<Icon size={12} />
			</span>
			<div className="min-w-0 flex-1 leading-tight">
				<p className="truncate text-[12.5px] font-medium text-[var(--color-ink-900)]">{check.title}</p>
			</div>
			{check.href ? (
				<span className="shrink-0 text-[11px] font-semibold text-[var(--color-accent-700)]" aria-hidden>
					Resolve
				</span>
			) : null}
		</div>
	);
	return (
		<li>
			{check.href ? (
				<Link href={check.href} className="tap">
					{content}
				</Link>
			) : (
				content
			)}
		</li>
	);
}
