import { Suspense } from "react";
import { redirect } from "next/navigation";

import { HomeBanner } from "@/app/_components/home/HomeBanner";
import { getProductsPageCached, getCategoriesCached } from "@/lib/core/cached";
import { ShopProductFeed } from "@/components/shared/ShopProductFeed";
import { ShopCategoryToolbar } from "@/app/_components/shop/ShopCategoryToolbar";
import { parseFiltersFromSearchParams, type ProductFilters } from "@/lib/core";

export async function HomePageContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
	const filters = parseFiltersFromSearchParams(searchParams);
	const categories = await getCategoriesCached();
	const visibleCategories = categories.filter(c => c.isActive);
	
	// Default to first category if none selected
	if (!filters.categorySlug && visibleCategories.length > 0) {
		redirect(`/?category=${visibleCategories[0].slug}#shop-catalog`);
	}

	return (
		<>
			<HomeBanner />
			<HomeMarquee />
			<Suspense fallback={null}>
				<HomeProductFeed filters={filters} />
			</Suspense>
		</>
	);
}

function HomeMarquee() {
	return (
		<div className="w-full overflow-hidden bg-[var(--color-ink-900)] py-3 border-y border-[var(--color-ink-900)]">
			<div className="flex whitespace-nowrap animate-marquee">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-400)]">
						<span className="mx-6">Free Nationwide Delivery</span>
						<span className="mx-6 text-white/30">•</span>
						<span className="mx-6">Premium Quality Assured</span>
						<span className="mx-6 text-white/30">•</span>
						<span className="mx-6">5-Year Motor Warranty</span>
						<span className="mx-6 text-white/30">•</span>
						<span className="mx-6">Expert Installation Available</span>
						<span className="mx-6 text-white/30">•</span>
					</div>
				))}
			</div>
		</div>
	);
}

async function HomeProductFeed({ filters }: { filters: ProductFilters }) {
	let page;
	try {
		page = await getProductsPageCached({ ...filters, limit: 24 });
	} catch (e) {
		return null;
	}

	if (!page || page.products.length === 0 && Object.keys(filters).length === 0) return null;

	return (
		<section id="shop-catalog" className="bg-[var(--color-ink-50)] py-12 md:py-20 border-t border-[var(--color-ink-100)]">
			<div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
				<div className="mb-8">
					<Suspense fallback={null}>
						<ShopCategoryToolbar activeSlug={filters.categorySlug || ""} filters={filters} hideCategories={false} />
					</Suspense>
				</div>
				<ShopProductFeed 
					initialPage={page} 
					categoryLabel="Products" 
					apiParams={filters.categorySlug ? { category: filters.categorySlug } : {}} 
					priorityCount={4} 
				/>
			</div>
		</section>
	);
}
