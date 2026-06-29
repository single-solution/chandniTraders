import { WorkspaceFrame } from "@/components/shared/workspaceUi";

export function SettingsWorkspaceSkeleton() {
	return (
		<WorkspaceFrame minHeight={false}>
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-3 md:px-4">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className="size-9 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
					<div className="min-w-0 space-y-1.5">
						<div className="h-3.5 w-20 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="h-2.5 w-48 animate-pulse rounded bg-[var(--color-ink-100)]/70" />
					</div>
				</div>
			</header>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-52">
					<div className="h-2.5 w-14 animate-pulse rounded bg-[var(--color-ink-100)]" />
					<div className="mt-3 space-y-1">
						{Array.from({ length: 8 }).map((_, index) => (
							<div key={index} className="h-7 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
						))}
					</div>
				</aside>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="shrink-0 border-b border-[var(--color-ink-100)] px-4 py-3 md:px-5">
						<div className="h-4 w-28 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-[var(--color-ink-100)]/70" />
					</div>
					<div className="p-4 md:p-5">
						<div className="mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-6">
							<div className="space-y-4">
								{Array.from({ length: 4 }).map((_, index) => (
									<div key={index} className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</WorkspaceFrame>
	);
}
