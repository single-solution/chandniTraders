import { Suspense } from "react";

import { ListPageShell } from "@/components/shared/ListPageShell";
import { Offers } from "@/app/offers/_components/Offers";
import { ListWorkspaceSkeleton } from "@/components/loading/ListWorkspaceSkeleton";

import { loadAdminOffersCached } from "@/lib/cached";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminOffersPage() {
	await requirePagePermission("offer_manage", "/offers");

	return (
		<ListPageShell>
			<Suspense fallback={<ListWorkspaceSkeleton />}>
				<OffersData />
			</Suspense>
		</ListPageShell>
	);
}

async function OffersData() {
	const offers = await loadAdminOffersCached();
	return <Offers offers={offers} />;
}
