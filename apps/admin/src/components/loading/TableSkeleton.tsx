import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shared skeleton for the standard admin list view: a filter/search bar
 * across the top, then a card containing a header row and N data rows.
 *
 * The dimensions intentionally match the shipped table components
 * (`Orders`, `BrandsTable`, `Customers`, …) — they're all built
 * on the same `rounded-[var(--radius-lg)] border + bg-[surface]` card,
 * a tabular header row, and rows separated by a 1px divider.
 */
interface TableSkeletonProps {
	/** Number of column-header chips to draw. Match the real table. */
	columnCount?: number;
	/** Number of data rows to skeleton. Defaults to 10 — fills the visible
	 *  area without scrolling on most laptops. */
	rowCount?: number;
	/** When true, render the search/filter bar above the table. Most list
	 *  pages have one; activity log and a few others do not. */
	hasFilterBar?: boolean;
}

const DEFAULT_COLUMN_COUNT = 5;
const DEFAULT_ROW_COUNT = 10;

export function TableSkeleton({ columnCount = DEFAULT_COLUMN_COUNT, rowCount = DEFAULT_ROW_COUNT, hasFilterBar = true }: TableSkeletonProps) {
	return (
		<div className="space-y-4">
			{hasFilterBar && <FilterBarSkeleton />}
			<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
				{/* Header row */}
				<div
					className="grid items-center gap-4 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-4 py-3"
					style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
				>
					{Array.from({ length: columnCount }).map((_, index) => (
						<Skeleton key={index} shape="text" className="h-3 w-20" />
					))}
				</div>
				{/* Data rows */}
				<ul className="divide-y divide-[var(--color-ink-100)]">
					{Array.from({ length: rowCount }).map((_, rowIndex) => (
						<li key={rowIndex} className="grid items-center gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
							{Array.from({ length: columnCount }).map((_, columnIndex) => (
								<Skeleton key={columnIndex} shape="text" className={`h-4 ${columnIndex === 0 ? "w-3/4" : columnIndex === columnCount - 1 ? "w-16" : "w-1/2"}`} />
							))}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function FilterBarSkeleton() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Skeleton shape="pill" className="h-9 w-64 md:w-80" />
			<Skeleton shape="pill" className="h-9 w-28" />
			<Skeleton shape="pill" className="h-9 w-28" />
			<div className="ml-auto">
				<Skeleton shape="pill" className="h-9 w-32" />
			</div>
		</div>
	);
}
