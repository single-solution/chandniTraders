/**
 * Account overview skeleton.
 *
 * Mirrors the real page layout (header → loyalty card → three stat tiles →
 * recent-orders column + profile/quick-actions aside) at the same storefront
 * shell as the shop / checkout / home pages, so there's no width jump or
 * reflow when the live data swaps in.
 */
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";
const STAT_TILE_COUNT = 3;
const ORDER_ROW_COUNT = 3;
const QUICK_ACTION_COUNT = 3;

export default function AccountLoading() {
	return (
		<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-6 md:pb-16 md:pt-10`}>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div className="space-y-2">
					<div className="skeleton h-3 w-24" />
					<div className="skeleton h-8 w-56" />
					<div className="skeleton h-3 w-72" />
				</div>
				<div className="skeleton h-8 w-40 rounded-full" />
			</div>

			<div className="skeleton mt-5 h-[200px] rounded-[var(--radius-xl)] md:mt-8 md:h-[220px]" />

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-3">
				{Array.from({ length: STAT_TILE_COUNT }).map((_, index) => (
					<div key={index} className="rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
						<div className="skeleton size-8 rounded-[var(--radius-md)]" />
						<div className="skeleton mt-3 h-6 w-20" />
						<div className="skeleton mt-2 h-3 w-24" />
					</div>
				))}
			</div>

			<div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[1fr_320px] md:gap-6 lg:gap-8">
				<div className="space-y-4">
					<div className="space-y-2">
						<div className="skeleton h-3 w-28" />
						<div className="skeleton h-6 w-60" />
					</div>
					<div className="space-y-3">
						{Array.from({ length: ORDER_ROW_COUNT }).map((_, index) => (
							<div key={index} className="skeleton h-[104px] rounded-[var(--radius-lg)]" />
						))}
					</div>
				</div>

				<aside className="space-y-4">
					<div className="skeleton h-[200px] rounded-[var(--radius-lg)]" />
					<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
						<div className="border-b border-[var(--color-ink-100)] px-4 py-3 md:px-5">
							<div className="skeleton h-3 w-24" />
						</div>
						<ul className="divide-y divide-[var(--color-ink-100)]">
							{Array.from({ length: QUICK_ACTION_COUNT }).map((_, index) => (
								<li key={index} className="flex items-center gap-3 px-4 py-3 md:px-5">
									<div className="skeleton size-8 shrink-0 rounded-[var(--radius-md)]" />
									<div className="min-w-0 flex-1 space-y-1.5">
										<div className="skeleton h-3 w-28" />
										<div className="skeleton h-2.5 w-36" />
									</div>
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>
		</div>
	);
}
