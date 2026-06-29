"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { classNames } from "@store/shared";
import { PERFORMANCE_COMPARES, PERFORMANCE_RANGES, type PerformanceCompare, type PerformanceRange } from "@/lib/dashboard/performancePeriod";
import { pingNavigationProgress } from "@/lib/navigation/navigationProgress";

const RANGE_LABELS: Record<PerformanceRange, string> = {
	today: "Today",
	week: "Week",
	month: "Month",
	year: "Year",
};

const COMPARE_LABELS: Record<PerformanceCompare, string> = {
	previous: "Previous period",
	last_year: "Last year",
};

interface PerformancePeriodSelectorProps {
	range: PerformanceRange;
	compare: PerformanceCompare;
}

/**
 * Two segmented controls that drive the dashboard performance panel.
 *
 * Range  → one of `today | week | month | year` (URL `?range=`).
 * Compare→ one of `previous | last_year`        (URL `?compare=`).
 *
 * URL state is the single source of truth so refreshing the page (or
 * sharing the URL) preserves the operator's view. We use `replace` (not
 * `push`) so clicking through ranges doesn't pollute the back stack.
 *
 * Wrapped in `startTransition` so the page can keep rendering while the
 * server-side panel re-fetches — gives an instant feel even when the
 * cache miss takes a beat.
 */
export function PerformancePeriodSelector({ range, compare }: PerformancePeriodSelectorProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// Local transition stays — the dashboard panel is Suspense-keyed on the
	// range/compare params, so without a transition every click would flash
	// the skeleton fallback. Pinging the global bar separately gives the
	// operator the "something's happening" cue while React keeps the old
	// panel painted under the cover of `startTransition`.
	const [isPending, startTransition] = useTransition();

	function pushParam(key: string, value: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set(key, value);
		const url = `${pathname}?${params.toString()}`;
		pingNavigationProgress();
		startTransition(() => {
			router.replace(url, { scroll: false });
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-2 md:gap-3">
			<SegmentedControl
				ariaLabel="Performance range"
				value={range}
				options={PERFORMANCE_RANGES.map((id) => ({ id, label: RANGE_LABELS[id] }))}
				onChange={(value) => pushParam("range", value)}
				loading={isPending}
			/>
			<SegmentedControl
				ariaLabel="Compare to"
				value={compare}
				options={PERFORMANCE_COMPARES.map((id) => ({
					id,
					label: COMPARE_LABELS[id],
				}))}
				onChange={(value) => pushParam("compare", value)}
				loading={isPending}
				muted
			/>
		</div>
	);
}

interface SegmentedControlProps<T extends string> {
	ariaLabel: string;
	value: T;
	options: ReadonlyArray<{ id: T; label: string }>;
	onChange(value: T): void;
	loading?: boolean;
	/** Lower-contrast visual treatment for secondary toggles. */
	muted?: boolean;
}

function SegmentedControl<T extends string>({ ariaLabel, value, options, onChange, loading, muted }: SegmentedControlProps<T>) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={classNames(
				"inline-flex shrink-0 items-center rounded-[var(--radius-md)] border p-0.5",
				muted ? "border-[var(--color-ink-100)] bg-[var(--color-canvas)]" : "border-[var(--color-ink-200)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]",
				loading && "opacity-80",
			)}
		>
			{options.map((option) => {
				const active = option.id === value;
				return (
					<button
						key={option.id}
						type="button"
						aria-pressed={active}
						onClick={() => {
							if (!active) onChange(option.id);
						}}
						className={classNames(
							"tap rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold transition-colors md:text-[11.5px]",
							active ? "bg-[var(--color-accent-100)] text-[var(--color-accent-900)] shadow-[var(--shadow-xs)]" : "text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
