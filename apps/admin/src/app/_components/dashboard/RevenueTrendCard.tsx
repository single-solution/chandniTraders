import { TrendingUp } from "lucide-react";

interface RevenueTrendPoint {
	date: string;
	rupees: number;
}

interface RevenueTrendCardProps {
	points: RevenueTrendPoint[];
	totalLabel: string;
	peakLabel: string;
	peakDateLabel: string;
	activeDays: number;
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 96;
/** Floor so a flat zero series still shows a hairline baseline, not an empty box. */
const CHART_BASELINE_PADDING = 6;

function buildGeometry(points: RevenueTrendPoint[]): { line: string; area: string } {
	if (points.length === 0) {
		return { line: "", area: "" };
	}
	const maxRupees = Math.max(...points.map((point) => point.rupees), 1);
	const usableHeight = CHART_HEIGHT - CHART_BASELINE_PADDING;
	const stepX = points.length > 1 ? CHART_WIDTH / (points.length - 1) : 0;
	const coordinates = points.map((point, index) => {
		const x = index * stepX;
		const y = CHART_HEIGHT - (point.rupees / maxRupees) * usableHeight;
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	});
	const line = coordinates.join(" ");
	const firstX = "0.00";
	const lastX = ((points.length - 1) * stepX).toFixed(2);
	const area = `${firstX},${CHART_HEIGHT} ${line} ${lastX},${CHART_HEIGHT}`;
	return { line, area };
}

/**
 * 30-day revenue trend — a filled area sparkline with a headline total and a
 * peak-day call-out. Pure presentational server component: the page passes the
 * raw series for geometry plus pre-formatted money labels so currency rendering
 * stays in one place.
 */
export function RevenueTrendCard({ points, totalLabel, peakLabel, peakDateLabel, activeDays }: RevenueTrendCardProps) {
	const { line, area } = buildGeometry(points);
	const hasData = points.some((point) => point.rupees > 0);

	return (
		<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
			<div className="flex items-end justify-between gap-3 px-4 pt-4 md:px-5">
				<div>
					<p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-ink-600)]">
						<TrendingUp size={14} className="text-[var(--color-accent-700)]" />
						Revenue trend
					</p>
					<p className="mt-1 text-[24px] font-semibold leading-none tracking-tight text-[var(--color-ink-900)] sm:text-[26px]">{totalLabel}</p>
					<p className="mt-1 text-[11.5px] text-[var(--color-ink-500)]">Last 30 days</p>
				</div>
				<div className="text-right">
					<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-400)]">Peak day</p>
					<p className="mt-1 text-[13px] font-semibold text-[var(--color-ink-900)]">{peakLabel}</p>
					<p className="text-[11px] text-[var(--color-ink-500)]">{peakDateLabel}</p>
				</div>
			</div>
			<div className="mt-3 px-1.5 pb-1.5">
				{hasData ? (
					<svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
						<defs>
							<linearGradient id="revenue-trend-fill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.45" />
								<stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0" />
							</linearGradient>
						</defs>
						<polygon points={area} fill="url(#revenue-trend-fill)" />
						<polyline points={line} fill="none" stroke="var(--color-accent-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
					</svg>
				) : (
					<div className="grid h-24 place-items-center text-[12px] text-[var(--color-ink-400)]">No revenue in the last 30 days.</div>
				)}
			</div>
			<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/50 px-4 py-2 text-[11px] font-medium text-[var(--color-ink-500)] md:px-5">
				{activeDays} {activeDays === 1 ? "day" : "days"} with sales in this window
			</div>
		</div>
	);
}
