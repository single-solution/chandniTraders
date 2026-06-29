import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";

const CART_LINE_COUNT = 3;

function CartLineSkeleton() {
	return (
		<li className="flex gap-3 p-3 md:p-4">
			<Skeleton className="size-[72px] shrink-0 rounded-[var(--radius-md)] md:size-20" />
			<div className="min-w-0 flex-1 space-y-2">
				<Skeleton shape="text" className="h-4 w-3/4" />
				<Skeleton shape="text" className="h-3 w-1/2" />
				<div className="flex items-center justify-between gap-2 pt-1">
					<Skeleton shape="pill" className="h-8 w-24" />
					<Skeleton shape="text" className="h-4 w-16" />
				</div>
			</div>
		</li>
	);
}

/** Shape-matched cart page body — wrap with `SkeletonScreen` at route boundaries only. */
export function CartPageSkeletonBody() {
	return (
		<div className="mx-auto flex h-[calc(100dvh-var(--mobile-header-h)-var(--mobile-tabbar-h)-env(safe-area-inset-bottom,0px)-32px)] max-w-[1100px] flex-col px-4 pt-4 md:block md:h-auto md:px-6 md:pb-16 md:pt-10 lg:px-8">
			<div className="space-y-2">
				<Skeleton shape="text" className="h-8 w-36 md:h-9 md:w-40" />
				<Skeleton shape="text" className="h-3 w-44 md:w-52" />
			</div>

			<div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 md:mt-6 md:grid md:flex-none md:grid-cols-[1fr_320px] md:gap-6 lg:grid-cols-[1fr_360px]">
				<ul className="min-h-0 flex-1 divide-y divide-[var(--color-ink-100)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] md:flex-none">
					{Array.from({ length: CART_LINE_COUNT }).map((_, index) => (
						<CartLineSkeleton key={index} />
					))}
				</ul>

				<aside className="shrink-0 space-y-3">
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 md:p-5">
						<Skeleton shape="text" className="h-3 w-24" />
						<div className="mt-3 space-y-2">
							<Skeleton shape="text" className="h-3 w-full" />
							<Skeleton shape="text" className="h-3 w-4/5" />
							<Skeleton shape="text" className="h-4 w-1/3" />
						</div>
						<Skeleton shape="pill" className="mt-4 h-11 w-full" />
					</div>
				</aside>
			</div>
		</div>
	);
}

/** Route-level cart placeholder (includes live region for assistive tech). */
export function CartPageSkeleton() {
	return (
		<SkeletonScreen label="Loading cart">
			<CartPageSkeletonBody />
		</SkeletonScreen>
	);
}
