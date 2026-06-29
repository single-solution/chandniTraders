export function CatalogWorkspaceSkeleton() {
	return (
		<div className="flex min-h-[min(72vh,680px)] flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-48">
					<div className="h-3 w-16 animate-pulse rounded bg-[var(--color-ink-100)]" />
					<div className="mt-3 h-8 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
					<div className="mt-3 space-y-1.5">
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className="h-7 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
						))}
					</div>
				</aside>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="shrink-0 space-y-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2">
						<div className="h-4 w-28 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="h-8 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
						<div className="flex flex-wrap gap-1.5">
							{Array.from({ length: 4 }).map((_, index) => (
								<div key={index} className="h-6 w-16 animate-pulse rounded-full bg-[var(--color-ink-100)]/70" />
							))}
						</div>
					</div>
					<div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2">
						{Array.from({ length: 10 }).map((_, index) => (
							<div key={index} className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
