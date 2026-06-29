import { Suspense } from "react";

import { CustomersCatalog } from "@/app/customers/_components/CustomersCatalog";
import { SalesWorkspaceSkeleton } from "@/components/loading/SalesWorkspaceSkeleton";
import { adminWorkspacePageClass } from "@/components/shared/workspaceUi";

import { ADMIN_LOYALTY_POINT_TO_RUPEE, loadAdminCustomersPage } from "@/lib/cached";
import { firstParam, type AdminPageSearchParams } from "@/lib/server/searchParams";
import type { CustomerSegment } from "@/lib/server/customerListQuery";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<AdminPageSearchParams> }) {
	await requirePagePermission("customer_view", "/customers");
	const params = await searchParams;

	return (
		<div className={adminWorkspacePageClass}>
			<section className="flex min-h-0 flex-1 flex-col">
				<Suspense fallback={<SalesWorkspaceSkeleton />}>
					<CustomersData params={params} />
				</Suspense>
			</section>
		</div>
	);
}

async function CustomersData({ params }: { params: AdminPageSearchParams }) {
	const search = firstParam(params.query);
	const segmentParam = firstParam(params.segment);
	const segment: CustomerSegment = segmentParam === "loyalty" || segmentParam === "active" ? segmentParam : "all";
	// Only the (fast) list page blocks first paint; the collection-wide segment
	// counts + loyalty total stream in client-side behind a shimmer.
	const initial = await loadAdminCustomersPage({ search, segment });
	return <CustomersCatalog initial={initial} programmeRupeesPerPoint={ADMIN_LOYALTY_POINT_TO_RUPEE} />;
}
