import { ShopActiveFilterChips } from "@/app/_components/shop/ShopActiveFilterChips";
import { ShopBrandCards } from "@/app/_components/shop/ShopBrandCards";
import { ShopCategoryCards } from "@/app/_components/shop/ShopCategoryCards";
import { ShopFilterRow } from "@/app/_components/shop/ShopFilterRow";
import { FloatingFiltersPortal } from "@/app/_components/shop/FloatingFiltersPortal";
import { getFacets } from "@/lib/core/facets";
import { getBrandsCached, getCategoriesCached } from "@/lib/core/cached";
import type { ProductFilters } from "@/lib/core";

interface ShopCategoryToolbarProps {
	activeSlug: string;
	filters: ProductFilters;
	hideCategories?: boolean;
}

export async function ShopCategoryToolbar({ activeSlug, filters, hideCategories = false }: ShopCategoryToolbarProps) {
	const [categories, brands, initialFacets] = await Promise.all([
		getCategoriesCached(),
		getBrandsCached(activeSlug),
		getFacets(filters),
	]);

	const filterProps = {
		categorySlug: activeSlug,
		brands,
		initialFacets,
	};

	return (
		<>
			<div className="md:hidden flex min-w-0 flex-col gap-2 pb-4">
				{!hideCategories && (
					<div className="flex flex-col items-center gap-4 pt-4 pb-2">
						<div className="text-center">
							<h2 className="text-[1.5rem] font-light leading-tight tracking-tight text-[var(--color-ink-900)]">What are you looking for?</h2>
						</div>
						<ShopCategoryCards categories={categories} activeSlug={activeSlug} centered />
					</div>
				)}
				{!hideCategories && <ShopBrandCards brands={brands} centered />}
			</div>

			<div className="shop-listing-toolbar-sticky md:hidden">
				<div className="shop-listing-toolbar flex items-center justify-center gap-2 p-2">
					<ShopFilterRow {...filterProps} />
				</div>
			</div>

			<div className="hidden min-w-0 flex-col gap-3 pb-4 md:flex md:pb-5">
				{!hideCategories && (
					<div className="flex flex-col items-center gap-6 pt-8 pb-4">
						<div className="text-center">
							<h2 className="text-[2rem] font-light leading-tight tracking-tight text-[var(--color-ink-900)]">What are you looking for?</h2>
						</div>
						<ShopCategoryCards categories={categories} activeSlug={activeSlug} centered />
					</div>
				)}
				{!hideCategories && <ShopBrandCards brands={brands} centered />}
				<ShopActiveFilterChips {...filterProps} />
			</div>

			<FloatingFiltersPortal>
				<div className="hidden md:flex">
					<ShopFilterRow {...filterProps} />
				</div>
			</FloatingFiltersPortal>
		</>
	);
}
