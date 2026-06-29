import { UserCircle } from "lucide-react";

import { ListPageShell } from "@/components/shared/ListPageShell";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { WorkspaceFrame, WorkspaceListHeader } from "@/components/shared/workspaceUi";

/**
 * Route-segment fallback for `/account`.
 *
 * The account page is a single-column form (`AccountSettings`), not a
 * list — so the generic `ListWorkspaceSkeleton` was a layout mismatch
 * that visibly snapped to the wrong shape when data arrived. This
 * fallback mirrors the in-component skeleton inside `AccountSettings`
 * exactly (header + two form sections each with three field bars + a
 * submit-button bar) so segment → page → loaded transitions are all
 * pixel-stable.
 */
export default function AdminAccountLoading() {
	return (
		<SkeletonScreen label="Loading account">
			<ListPageShell>
				<WorkspaceFrame minHeight={false}>
					<WorkspaceListHeader iconElement={<UserCircle size={15} />} title="Your profile" subtitle="Manage your name, email, and admin sign-in password." />
					<div className="mx-auto w-full max-w-3xl p-4 md:p-5">
						<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-sm)] md:px-6">
							{Array.from({ length: 2 }).map((_, section) => (
								<div key={section} className="grid gap-5 border-b border-[var(--color-ink-100)] py-6 first:pt-6 last:border-b-0 lg:grid-cols-[220px_minmax(0,360px)] lg:gap-10">
									<div>
										<Skeleton shape="text" className="h-4 w-24" />
										<Skeleton shape="text" className="mt-2 h-3 w-44" />
									</div>
									<div className="space-y-3">
										{Array.from({ length: 3 }).map((__, field) => (
											<Skeleton key={field} shape="text" className="h-9 w-full" />
										))}
										<Skeleton shape="text" className="h-9 w-28" />
									</div>
								</div>
							))}
						</div>
					</div>
				</WorkspaceFrame>
			</ListPageShell>
		</SkeletonScreen>
	);
}
