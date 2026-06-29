import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

function CheckoutPanelSkeleton({ tall = false }: { tall?: boolean }) {
	return (
		<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 md:p-5">
			<Skeleton shape="text" className="h-3 w-28" />
			<div className="mt-3 space-y-2.5">
				<Skeleton shape="pill" className="h-10 w-full" />
				<Skeleton shape="pill" className="h-10 w-full" />
				{tall ? <Skeleton shape="pill" className="h-24 w-full" /> : null}
			</div>
		</div>
	);
}

/** Checkout shell placeholder while auth + customer data resolve. */
export function CheckoutPageSkeleton() {
	return (
		<SkeletonScreen label="Loading checkout">
			<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-4 md:pb-16 md:pt-10`}>
				<div className="space-y-2">
					<Skeleton shape="text" className="h-8 w-44 md:h-9 md:w-52" />
					<Skeleton shape="text" className="h-3 w-64 md:w-80" />
				</div>

				<div className="mt-5 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
					<div className="space-y-3 md:space-y-4">
						<CheckoutPanelSkeleton />
						<CheckoutPanelSkeleton tall />
						<CheckoutPanelSkeleton />
					</div>

					<aside className="space-y-3 md:space-y-4">
						<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 md:p-5">
							<Skeleton shape="text" className="h-3 w-24" />
							<div className="mt-3 space-y-2">
								{Array.from({ length: 4 }).map((_, index) => (
									<Skeleton key={index} shape="text" className="h-3 w-full" />
								))}
							</div>
							<Skeleton shape="text" className="mt-4 h-5 w-1/3" />
							<Skeleton shape="pill" className="mt-4 h-11 w-full" />
						</div>
					</aside>
				</div>
			</div>
		</SkeletonScreen>
	);
}
