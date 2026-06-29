import { SalesWorkspaceSkeleton } from "@/components/loading/SalesWorkspaceSkeleton";
import { adminWorkspacePageClass } from "@/components/shared/workspaceUi";
import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function OrdersLoading() {
	return (
		<SkeletonScreen label="Loading orders">
			<div className={adminWorkspacePageClass}>
				<section className="flex min-h-0 flex-1 flex-col">
					<SalesWorkspaceSkeleton />
				</section>
			</div>
		</SkeletonScreen>
	);
}
