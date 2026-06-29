import { Suspense } from "react";

import { Inquiries } from "@/app/inquiries/_components/Inquiries";
import { InquiriesInboxSkeleton } from "@/components/loading/InquiriesInboxSkeleton";
import { adminWorkspacePageClass } from "@/components/shared/workspaceUi";

import { loadAdminInquiriesPage } from "@/lib/cached";
import { firstParam, type AdminPageSearchParams } from "@/lib/server/searchParams";
import { requirePagePermission } from "@/lib/server/requirePageSession";
import type { PermissionKey } from "@/lib/permissionsCatalog";

export const dynamic = "force-dynamic";

export interface InquiriesPageAccess {
	actorId: string;
	actorName: string;
	permissions: PermissionKey[];
}

export default async function AdminInquiriesPage({ searchParams }: { searchParams: Promise<AdminPageSearchParams> }) {
	const { actor, permissions } = await requirePagePermission("inquiry_view", "/inquiries");
	const params = await searchParams;

	const access: InquiriesPageAccess = {
		actorId: actor.id,
		actorName: actor.name,
		permissions,
	};

	return (
		<div className={adminWorkspacePageClass}>
			<section className="flex min-h-0 flex-1 flex-col">
				<Suspense fallback={<InquiriesInboxSkeleton />}>
					<InquiriesData access={access} params={params} />
				</Suspense>
			</section>
		</div>
	);
}

async function InquiriesData({ access, params }: { access: InquiriesPageAccess; params: AdminPageSearchParams }) {
	const initial = await loadAdminInquiriesPage({ search: firstParam(params.query) });
	return <Inquiries initial={initial} access={access} />;
}
