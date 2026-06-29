import type { ReactNode } from "react";

import { SkeletonScreen } from "@/components/ui/Skeleton";
import { adminListPageClass } from "@/components/shared/workspaceUi";
import { ListWorkspaceSkeleton } from "@/components/loading/ListWorkspaceSkeleton";

export function ListPageShell({ children }: { children: ReactNode }) {
	return (
		<div className={adminListPageClass}>
			<section className="flex min-h-0 flex-1 flex-col">{children}</section>
		</div>
	);
}

export function AdminListPageLoading({ label }: { label: string }) {
	return (
		<SkeletonScreen label={label}>
			<ListPageShell>
				<ListWorkspaceSkeleton />
			</ListPageShell>
		</SkeletonScreen>
	);
}
