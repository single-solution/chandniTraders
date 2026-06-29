import { InquiriesInboxSkeleton } from "@/components/loading/InquiriesInboxSkeleton";
import { adminWorkspacePageClass } from "@/components/shared/workspaceUi";
import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function InquiriesLoading() {
	return (
		<SkeletonScreen label="Loading inquiries">
			<div className={adminWorkspacePageClass}>
				<section className="flex min-h-0 flex-1 flex-col">
					<InquiriesInboxSkeleton />
				</section>
			</div>
		</SkeletonScreen>
	);
}
