import { Suspense } from "react";

import { ListPageShell } from "@/components/shared/ListPageShell";
import { TeamCatalog } from "@/app/team/_components/TeamCatalog";
import { ListWorkspaceSkeleton } from "@/components/loading/ListWorkspaceSkeleton";

import { loadAdminTeamCached } from "@/lib/cached";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
	const { actor } = await requirePagePermission("team_view", "/team");

	return (
		<ListPageShell>
			<Suspense fallback={<ListWorkspaceSkeleton />}>
				<TeamData currentUserId={actor.id} isCurrentUserSuperAdmin={actor.isSuperAdmin} />
			</Suspense>
		</ListPageShell>
	);
}

interface TeamDataProps {
	currentUserId: string;
	isCurrentUserSuperAdmin: boolean;
}

async function TeamData({ currentUserId, isCurrentUserSuperAdmin }: TeamDataProps) {
	const members = await loadAdminTeamCached();
	return <TeamCatalog members={members} currentUserId={currentUserId} isCurrentUserSuperAdmin={isCurrentUserSuperAdmin} />;
}
