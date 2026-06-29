import { ProductCardSkeleton } from "@/components/shared/ProductCardSkeleton";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

const RELATED_SKELETON_COUNT = 4;

function PdpGallerySkeleton() {
	return (
		<div className="product-media-well relative aspect-square w-full bg-[var(--color-canvas-deep)]">
			<Skeleton className="absolute inset-0 h-full w-full rounded-none" />
		</div>
	);
}

function PdpVariantPanelSkeleton({ layout }: { layout: "mobile" | "desktop" }) {
	if (layout === "mobile") {
		return (
			<div className="space-y-3">
				<div className="space-y-1.5">
					<Skeleton shape="text" className="h-3 w-16" />
					<Skeleton shape="text" className="h-7 w-3/4" />
				</div>
				<Skeleton shape="text" className="h-8 w-36" />
				<Skeleton shape="text" className="h-3 w-32" />
				<div className="flex flex-wrap gap-1.5">
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton key={index} className="h-9 w-24" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="space-y-1.5">
				<Skeleton shape="text" className="h-3 w-20" />
				<Skeleton shape="text" className="h-10 w-2/3" />
			</div>
			<div className="space-y-1.5">
				<Skeleton shape="text" className="h-9 w-44" />
				<Skeleton shape="text" className="h-3 w-40" />
			</div>
			<div className="flex flex-wrap gap-1.5">
				{Array.from({ length: 5 }).map((_, index) => (
					<Skeleton key={index} className="h-10 w-28" />
				))}
			</div>
			<Skeleton shape="pill" className="h-12 w-full" />
		</div>
	);
}

function PdpRelatedRailSkeleton({ layout }: { layout: "mobile" | "desktop" }) {
	if (layout === "mobile") {
		return (
			<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
				{Array.from({ length: RELATED_SKELETON_COUNT }).map((_, index) => (
					<ProductCardSkeleton key={index} />
				))}
			</div>
		);
	}

	return (
		<div className="mt-6 grid grid-cols-4 gap-5">
			{Array.from({ length: RELATED_SKELETON_COUNT }).map((_, index) => (
				<ProductCardSkeleton key={index} />
			))}
		</div>
	);
}

/** Full PDP placeholder — matches mobile/desktop shells and section rhythm. */
export function PdpPageSkeleton() {
	return (
		<SkeletonScreen label="Loading product">
			<div className="pdp-shell pb-[calc(80px+env(safe-area-inset-bottom,0px))] pt-2 md:hidden">
				<div
					className={`${STOREFRONT_SHELL_CLASS} overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]`}
				>
					<PdpGallerySkeleton />
				</div>

				<div className={`pdp-content ${STOREFRONT_SHELL_CLASS} space-y-5 pt-4`}>
					<PdpVariantPanelSkeleton layout="mobile" />
					<section className="pdp-related-panel space-y-3">
						<div className="flex items-center justify-between gap-3">
							<Skeleton shape="text" className="h-3 w-32" />
							<Skeleton shape="text" className="h-3 w-16" />
						</div>
						<PdpRelatedRailSkeleton layout="mobile" />
					</section>
				</div>
			</div>

			<div className={`pdp-shell hidden pb-12 pt-8 md:block ${STOREFRONT_SHELL_CLASS}`}>
				<div className="flex flex-wrap items-center gap-1.5">
					{Array.from({ length: 5 }).map((_, index) => (
						<Skeleton key={index} shape="text" className="h-3.5 w-14" />
					))}
				</div>

				<div className="mt-6 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-10">
					<div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)]">
						<PdpGallerySkeleton />
					</div>
					<PdpVariantPanelSkeleton layout="desktop" />
				</div>

				<section className="pdp-related-panel mt-16 space-y-3">
					<div className="flex items-end justify-between gap-3">
						<Skeleton shape="text" className="h-8 w-48" />
						<Skeleton shape="text" className="h-4 w-28" />
					</div>
					<PdpRelatedRailSkeleton layout="desktop" />
				</section>
			</div>
		</SkeletonScreen>
	);
}
