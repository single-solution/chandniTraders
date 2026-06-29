import { Skeleton } from "@/components/ui/Skeleton";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

export default function OrderDetailLoading() {
	return (
		<div className={`${STOREFRONT_SHELL_CLASS} space-y-4 pb-24 pt-4 md:pb-16 md:pt-10`}>
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-10 w-56" />
			<div className="grid gap-4 md:grid-cols-[1fr_360px]">
				<div className="space-y-4">
					<Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
					<Skeleton className="h-56 w-full rounded-[var(--radius-lg)]" />
				</div>
				<Skeleton className="h-48 w-full rounded-[var(--radius-lg)]" />
			</div>
		</div>
	);
}
