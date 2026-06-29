import { WorkspaceFrame } from "@/components/shared/workspaceUi";

export function ListWorkspaceSkeleton() {
	return (
		<WorkspaceFrame minHeight={false}>
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-3 md:px-4">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className="size-9 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
					<div className="min-w-0 space-y-1.5">
						<div className="h-3.5 w-28 animate-pulse rounded bg-[var(--color-ink-100)]" />
						<div className="h-2.5 w-40 animate-pulse rounded bg-[var(--color-ink-100)]/70" />
					</div>
				</div>
				<div className="h-8 w-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/80" />
			</header>
			<div className="space-y-2 p-3 md:p-4">
				{Array.from({ length: 8 }).map((_, index) => (
					<div key={index} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
				))}
			</div>
		</WorkspaceFrame>
	);
}
