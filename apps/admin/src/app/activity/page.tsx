import { Suspense } from "react";

import { ListPageShell } from "@/components/shared/ListPageShell";
import { ActivityFeed } from "@/app/activity/_components/ActivityFeed";
import { ListWorkspaceSkeleton } from "@/components/loading/ListWorkspaceSkeleton";

import { loadAdminActivityCached } from "@/lib/cached";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
	await requirePagePermission("activity_view", "/activity");

	return (
		<ListPageShell>
			<Suspense fallback={<ListWorkspaceSkeleton />}>
				<ActivityData />
			</Suspense>
		</ListPageShell>
	);
}

async function ActivityData() {
	const entries = await loadAdminActivityCached();
	return <ActivityFeed entries={entries} />;
}
