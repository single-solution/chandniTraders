import { adminDefaultPageClass } from "@/components/shared/workspaceUi";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * Dashboard-shaped fallback for the admin overview route segment.
 *
 * Exact-matches `app/page.tsx` (the dashboard) — mobile native layout
 * AND desktop layout — both wrapped in `Shell` so the chrome
 * (sidebar / top bar / footer) is in place from the first paint and
 * the real dashboard slots into the same DOM cells when it lands.
 *
 * Mobile:
 *   - "Overview" eyebrow + welcome title
 *   - "Today" KPI strip (4 cards in a 2×2)
 *   - "This month" KPI strip (4 cards in a 2×2)
 *   - "Recent inquiries" list (5 rows)
 *
 * Desktop:
 *   - 3 section headers, each followed by a 4-up KPI grid
 *     matching the real `<KpiCard>` chrome (label, value, hint, spark).
 */
const KPI_CARDS = 4;
const RECENT_INQUIRY_ROWS = 5;

export default function AdminDashboardLoading() {
	return (
		<SkeletonScreen label="Loading admin dashboard">
			<div className={adminDefaultPageClass}>
				{/* Mobile */}
				<div className="md:hidden">
					<div className="space-y-1.5">
						<Skeleton shape="text" className="h-2.5 w-16" />
						<Skeleton shape="text" className="h-5 w-40" />
					</div>

					<MobileKpiStripSkeleton heading="Today" />
					<MobileKpiStripSkeleton heading="This month" />

					<section className="app-section">
						<div className="app-section-eyebrow">
							<Skeleton shape="text" className="h-3 w-32" />
							<Skeleton shape="text" className="h-3 w-16" />
						</div>
						<ul className="app-list">
							{Array.from({ length: RECENT_INQUIRY_ROWS }).map((_, index) => (
								<li key={index} className="app-list-row">
									<Skeleton shape="circle" className="size-8" />
									<div className="min-w-0 flex-1 space-y-1.5">
										<div className="flex items-center gap-1.5">
											<Skeleton shape="text" className="h-3 w-24" />
											<Skeleton shape="pill" className="h-3.5 w-12" />
										</div>
										<Skeleton shape="text" className="h-3 w-32" />
									</div>
									<div className="space-y-1 text-right">
										<Skeleton shape="text" className="h-3 w-16" />
										<Skeleton shape="text" className="h-2.5 w-10" />
									</div>
								</li>
							))}
						</ul>
					</section>
				</div>

				{/* Desktop */}
				<div className="hidden md:block">
					<DesktopSectionHeaderSkeleton action />
					<DesktopKpiGridSkeleton />

					<DesktopSectionHeaderSkeleton />
					<DesktopKpiGridSkeleton />

					<DesktopSectionHeaderSkeleton />
					<DesktopKpiGridSkeleton />

					<DesktopSectionHeaderSkeleton />
					<ShopHealthSkeleton />
				</div>
			</div>
		</SkeletonScreen>
	);
}

function MobileKpiStripSkeleton({ heading }: { heading: string }) {
	return (
		<section className="app-section">
			<div className="app-section-eyebrow">
				<span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-400)]">{heading}</span>
				<Skeleton shape="text" className="h-3 w-16" />
			</div>
			<div className="grid grid-cols-2 gap-2">
				{Array.from({ length: KPI_CARDS }).map((_, index) => (
					<div key={index} className="rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-3">
						<div className="flex items-center justify-between gap-2">
							<Skeleton shape="text" className="h-3 w-16" />
							<Skeleton className="size-6" />
						</div>
						<Skeleton shape="text" className="mt-2 h-5 w-24" />
						<Skeleton shape="text" className="mt-1 h-3 w-12" />
					</div>
				))}
			</div>
		</section>
	);
}

function DesktopSectionHeaderSkeleton({ action }: { action?: boolean }) {
	return (
		<header className="mt-5 mb-2 flex flex-wrap items-end justify-between gap-2 first:mt-0">
			<div className="space-y-1.5">
				<Skeleton shape="text" className="h-3.5 w-48" />
				<Skeleton shape="text" className="h-2.5 w-64" />
			</div>
			{action ? (
				<div className="flex gap-2">
					<Skeleton shape="text" className="h-8 w-48" />
					<Skeleton shape="text" className="h-8 w-36" />
				</div>
			) : (
				<Skeleton shape="text" className="h-3 w-20" />
			)}
		</header>
	);
}

function ShopHealthSkeleton() {
	return (
		<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
			<div className="border-b border-[var(--color-ink-100)] px-4 py-3 md:px-5">
				<Skeleton shape="text" className="h-4 w-28" />
			</div>
			<div className="divide-y divide-[var(--color-ink-100)]">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="flex items-center gap-3 px-4 py-3 md:px-5">
						<Skeleton className="size-7 shrink-0" />
						<div className="flex-1 space-y-1.5">
							<Skeleton shape="text" className="h-3 w-48" />
							<Skeleton shape="text" className="h-2.5 w-64" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function DesktopKpiGridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
			{Array.from({ length: KPI_CARDS }).map((_, index) => (
				<div key={index} className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-3.5 sm:py-3">
					<div className="flex items-center justify-between gap-2">
						<Skeleton shape="text" className="h-3 w-20" />
						<Skeleton className="size-6" />
					</div>
					<div className="mt-2 flex items-center justify-between gap-2">
						<Skeleton shape="text" className="h-4 w-20" />
						<Skeleton shape="text" className="h-3 w-10" />
					</div>
				</div>
			))}
		</div>
	);
}
