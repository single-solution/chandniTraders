import { Suspense } from "react";

import { CategoriesCatalog } from "@/app/categories/_components/CategoriesCatalog";
import { CatalogWorkspaceSkeleton } from "@/components/loading/CatalogWorkspaceSkeleton";
import { adminCatalogPageClass } from "@/components/shared/workspaceUi";
import { Attribute, Brand, Category, connectDB } from "@store/db";
import { toAttributeResponse, type AttributeLean } from "@/lib/serializers/attribute";
import { toBrandResponse, type BrandLean } from "@/lib/serializers/brand";
import { toCategoryResponse, type CategoryLean } from "@/lib/serializers/category";
import { requirePagePermission } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
	await requirePagePermission("category_manage", "/categories");

	return (
		<div className={adminCatalogPageClass}>
			<section className="flex min-h-0 flex-1 flex-col">
				<Suspense fallback={<CatalogWorkspaceSkeleton />}>
					<CategoriesData />
				</Suspense>
			</section>
		</div>
	);
}

async function CategoriesData() {
	await connectDB();

	const [categoryDocs, brandDocs, attributeDocs] = await Promise.all([
		Category.find().sort({ sortOrder: 1, label: 1 }).lean<CategoryLean[]>(),
		Brand.find().sort({ name: 1 }).lean<BrandLean[]>(),
		Attribute.find().sort({ categorySlug: 1, label: 1 }).lean<AttributeLean[]>(),
	]);

	return (
		<CategoriesCatalog
			initialCategories={categoryDocs.map(toCategoryResponse)}
			initialBrands={brandDocs.map(toBrandResponse)}
			initialAttributes={attributeDocs.map(toAttributeResponse)}
		/>
	);
}
