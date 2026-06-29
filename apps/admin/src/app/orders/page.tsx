import { Suspense } from "react";

import { OrdersCatalog } from "@/app/orders/_components/OrdersCatalog";
import { SalesWorkspaceSkeleton } from "@/components/loading/SalesWorkspaceSkeleton";
import { adminWorkspacePageClass } from "@/components/shared/workspaceUi";

import { loadAdminOrdersPage } from "@/lib/cached";
import { firstParam, type AdminPageSearchParams } from "@/lib/server/searchParams";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<AdminPageSearchParams> }) {
	await requirePagePermission("order_view", "/orders");
	const params = await searchParams;

	return (
		<div className={adminWorkspacePageClass}>
			<section className="flex min-h-0 flex-1 flex-col">
				<Suspense fallback={<SalesWorkspaceSkeleton />}>
					<OrdersData params={params} />
				</Suspense>
			</section>
		</div>
	);
}

async function OrdersData({ params }: { params: AdminPageSearchParams }) {
	const search = firstParam(params.query);
	const status = firstParam(params.status);
	// Only the (fast) list page blocks first paint; the collection-wide status
	// counts + revenue stream in client-side behind a shimmer.
	const initial = await loadAdminOrdersPage({ search, status });
	return <OrdersCatalog initial={initial} />;
}
