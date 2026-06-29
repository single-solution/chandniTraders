import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the visible structure of `ProductCard` while data loads — image
 * well + meta strip + price footer — so the shop grid, deals grid and
 * any "related products" rail keep their layout stable across the loading →
 * loaded transition (no shift, no blank cells).
 */
export function ProductCardSkeleton() {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
			<div className="product-media-well relative aspect-square shrink-0 bg-[var(--color-canvas-deep)]">
				<Skeleton className="absolute inset-0 h-full w-full rounded-none" />
				<Skeleton shape="pill" className="absolute right-1.5 top-1.5 h-5 w-14 md:right-3 md:top-3 md:h-5 md:w-16" />
			</div>
			<div className="flex flex-1 flex-col">
				<div className="flex flex-1 flex-col gap-1 p-2 md:gap-1.5 md:p-2.5">
					<div className="space-y-1">
						<Skeleton shape="text" className="h-2.5 w-16" />
						<Skeleton shape="text" className="h-3.5 w-3/4" />
					</div>
				</div>
				<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 px-2 py-1.5 md:px-2.5 md:py-1.5">
					<div className="flex min-h-[2.25rem] content-start gap-1.5 pt-0.5 md:gap-2">
						<Skeleton shape="pill" className="h-[22px] w-14" />
						<Skeleton shape="pill" className="h-[22px] w-16" />
						<Skeleton shape="pill" className="h-[22px] w-12" />
					</div>
				</div>
			</div>
		</div>
	);
}

interface ProductGridSkeletonProps {
	count?: number;
	className?: string;
}

/**
 * Convenience grid wrapper that lays out N `ProductCardSkeleton`s using the
 * same responsive columns the live `ProductGrid` uses on the shop & deals
 * pages, so swapping in real cards is a pixel-stable transition.
 */
export function ProductGridSkeleton({ count = 8, className }: ProductGridSkeletonProps) {
	return (
		<div className={className ?? "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4"}>
			{Array.from({ length: count }).map((_, index) => (
				<ProductCardSkeleton key={index} />
			))}
		</div>
	);
}
