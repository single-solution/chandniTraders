import { Suspense } from "react";

import { ProductsCatalog } from "@/app/products/_components/ProductsCatalog";
import { CatalogWorkspaceSkeleton } from "@/components/loading/CatalogWorkspaceSkeleton";
import { adminCatalogPageClass } from "@/components/shared/workspaceUi";

import { loadAdminProductsCached } from "@/lib/cached";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

/**
 * Admin products index.
 *
 * Static-first: shell + Suspense skeleton render synchronously; the
 * cached products + wizard catalog load streams in once Mongo resolves.
 * Cache is busted by `bustAdminCaches()` on any product mutation.
 */
export default async function AdminProductsPage() {
	await requirePagePermission("product_view", "/products");
	return (
		<div className={adminCatalogPageClass}>
			<section className="flex min-h-0 flex-1 flex-col">
				<Suspense fallback={<CatalogWorkspaceSkeleton />}>
					<ProductsCatalogData />
				</Suspense>
			</section>
		</div>
	);
}

async function ProductsCatalogData() {
	const { products, catalog } = await loadAdminProductsCached();
	return <ProductsCatalog products={products} catalog={catalog} />;
}
