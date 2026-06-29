import { CatalogWorkspaceSkeleton } from "@/components/loading/CatalogWorkspaceSkeleton";
import { adminCatalogPageClass } from "@/components/shared/workspaceUi";
import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function ProductsLoading() {
	return (
		<SkeletonScreen label="Loading products">
			<div className={adminCatalogPageClass}>
				<section className="flex min-h-0 flex-1 flex-col">
					<CatalogWorkspaceSkeleton />
				</section>
			</div>
		</SkeletonScreen>
	);
}
