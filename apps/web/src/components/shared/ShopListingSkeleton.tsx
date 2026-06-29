import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { DEAL_BUTTONS_LAYOUT_CLASS } from "@/app/_components/shop/dealOfferButtonStyles";
import { SHOP_CATEGORY_GRID_CLASS, SHOP_CATEGORY_PAGE_CLASS, SHOP_CATEGORY_SKELETON_CARDS } from "@/lib/catalog/shopListingGrid";

/** Shape-matched fallback for `ShopIntroHero` (compact content layout). */
export function ShopIntroHeroFallback() {
	return (
		<section aria-hidden className="relative w-full border-b border-[var(--color-ink-100)] pt-[calc(var(--mobile-header-h)+1.5rem)] md:pt-[calc(var(--desktop-header-h)+2rem)]">
			<div className="mx-auto max-w-[1600px] px-6 pb-6 md:pb-10">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
					<div className="lg:col-span-5 space-y-6">
						<div className="space-y-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-12 w-64 sm:h-14 sm:w-80" />
							<Skeleton className="h-12 w-48 sm:h-14 sm:w-64" />
						</div>
						<Skeleton className="h-16 w-full max-w-md" />
						<Skeleton className="h-6 w-32 mt-4" />
					</div>
					<div className="lg:col-span-7">
						<div className="flex sm:hidden overflow-x-auto gap-4 no-scrollbar pb-4 -mx-6 px-6">
							<Skeleton className="w-[85vw] shrink-0 aspect-[4/3] rounded-[var(--radius-2xl)]" />
							<Skeleton className="w-[85vw] shrink-0 aspect-[4/3] rounded-[var(--radius-2xl)]" />
						</div>
						<div className="hidden sm:grid grid-cols-12 gap-6">
							<Skeleton className="col-span-12 sm:col-span-6 aspect-[4/3] sm:aspect-square rounded-[var(--radius-2xl)]" />
							<div className="col-span-12 sm:col-span-6 flex flex-col gap-6">
								<Skeleton className="aspect-[4/3] sm:aspect-square rounded-[var(--radius-2xl)] flex-1" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/**
 * Home catalog listing skeletons — used by category loading and Suspense fallbacks.
 */

export function ShopCategoryRailFallback({ pillCount = 6 }: { pillCount?: number }) {
	return (
		<nav aria-hidden className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 md:gap-2.5">
			{Array.from({ length: pillCount }).map((_, index) => (
				<Skeleton key={index} shape="pill" className="h-8 w-[4.5rem] shrink-0 md:w-20" />
			))}
		</nav>
	);
}

export function ShopCategoryPageLoading({ includeHero = false }: { includeHero?: boolean }) {
	return (
		<SkeletonScreen label="Loading shop">
			{includeHero ? <ShopIntroHeroFallback /> : null}
			<div className={`${SHOP_CATEGORY_PAGE_CLASS} pb-10 md:pb-20`}>
				<ShopCatalogToolbarFallback />
				<div className="shop-listing-mobile-scroll-pad pt-1">
					<ShopProductsAreaFallback />
				</div>
			</div>
		</SkeletonScreen>
	);
}

export function ShopFilterRowFallback() {
	return (
		<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-2.5" aria-hidden>
			{Array.from({ length: 4 }).map((_, pillIndex) => (
				<Skeleton key={pillIndex} shape="pill" className="h-8 w-[4.5rem] md:w-20" />
			))}
		</div>
	);
}

export function ShopCatalogToolbarFallback() {
	return (
		<>
			<div className="md:hidden flex min-w-0 flex-col gap-2 pb-4">
				{/* Hidden skeleton parts for the top section if needed */}
			</div>

			<div className="shop-listing-toolbar-sticky md:hidden">
				<div className="shop-listing-toolbar flex items-center justify-center gap-2 p-2" aria-hidden>
					<Skeleton shape="pill" className="h-9 w-24" />
					<Skeleton shape="pill" className="h-9 w-40" />
				</div>
			</div>

			<div className="hidden flex-col gap-3 pb-4 md:flex md:pb-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<ShopCategoryRailFallback />
					<ShopFilterRowFallback />
				</div>
			</div>
		</>
	);
}

export function ShopProductsAreaFallback() {
	return (
		<div className="min-h-[60vh] space-y-6 md:min-h-[70vh]">
			<ProductGridSkeleton count={SHOP_CATEGORY_SKELETON_CARDS} className={SHOP_CATEGORY_GRID_CLASS} />
			<div className="flex justify-center pt-2">
				<Skeleton shape="pill" className="h-10 w-32" />
			</div>
		</div>
	);
}
