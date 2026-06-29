export function InquiriesInboxSkeleton() {
	return (
		<div className="flex min-h-[min(72vh,680px)] flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="flex w-full shrink-0 flex-col border-b border-[var(--color-ink-100)] lg:w-[min(340px,38%)] lg:max-w-sm lg:border-b-0 lg:border-r">
					<div className="shrink-0 space-y-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2.5">
						<div className="h-4 w-24 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="h-8 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
					</div>
					<div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2">
						{Array.from({ length: 8 }).map((_, index) => (
							<div key={index} className="h-[72px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-ink-100)]/70" />
						))}
					</div>
				</aside>
				<section className="hidden min-h-0 flex-1 flex-col lg:flex">
					<div className="border-b border-[var(--color-ink-100)] px-5 py-4">
						<div className="h-5 w-40 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="mt-2 h-3 w-28 animate-pulse rounded bg-[var(--color-ink-100)]" />
					</div>
					<div className="flex-1 space-y-4 p-5">
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className={`h-14 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-ink-100)]/70 ${index % 2 === 0 ? "ml-auto w-[58%]" : "w-[62%]"}`} />
						))}
					</div>
					<div className="border-t border-[var(--color-ink-100)] p-4">
						<div className="h-11 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-ink-100)]/70" />
					</div>
				</section>
			</div>
		</div>
	);
}
