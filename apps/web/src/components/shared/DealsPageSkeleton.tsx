import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { SHOP_CATEGORY_GRID_CLASS, SHOP_CATEGORY_PAGE_CLASS, SHOP_CATEGORY_SKELETON_CARDS } from "@/lib/catalog/shopListingGrid";

const DEALS_HEADER_GRADIENT =
	"linear-gradient(180deg, color-mix(in srgb, var(--color-accent-50) 58%, var(--color-canvas)) 0%, var(--color-canvas) 62%, var(--color-canvas) 100%)";

/** Deals route placeholder — header, offer pills, product grid. */
export function DealsPageSkeleton() {
	return (
		<SkeletonScreen label="Loading deals">
			<section
				className="-mt-[var(--mobile-header-h)] pb-6 pt-[calc(var(--mobile-header-h)+1.75rem)] text-center md:-mt-[var(--desktop-header-h)] md:pb-8 md:pt-[calc(var(--desktop-header-h)+2.5rem)]"
				style={{ background: DEALS_HEADER_GRADIENT }}
			>
				<div className={`mx-auto flex w-full flex-col items-center ${SHOP_CATEGORY_PAGE_CLASS}`}>
					<Skeleton shape="pill" className="h-5 w-24" />
					<Skeleton shape="text" className="mt-4 h-10 w-56 md:h-14 md:w-72" />
					<Skeleton shape="text" className="mt-4 h-9 w-full max-w-md rounded-[var(--radius-md)] md:mt-5" />
				</div>
			</section>

			<div className={`${SHOP_CATEGORY_PAGE_CLASS} pb-10 md:pb-20`}>
				<section className="flex w-full flex-col gap-3 py-6 md:flex-row md:flex-wrap md:justify-center md:gap-2.5 md:py-8">
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton key={index} shape="block" className="h-[4.25rem] w-full rounded-[var(--radius-lg)] md:h-10 md:w-44 md:rounded-full" />
					))}
				</section>
				<section className="space-y-4 border-t border-[var(--color-ink-100)] pt-6 md:mt-4 md:border-t-0 md:pt-0">
					<Skeleton shape="text" className="h-5 w-28 md:h-8 md:w-36" />
					<ProductGridSkeleton count={SHOP_CATEGORY_SKELETON_CARDS} className={SHOP_CATEGORY_GRID_CLASS} />
				</section>
			</div>
		</SkeletonScreen>
	);
}
