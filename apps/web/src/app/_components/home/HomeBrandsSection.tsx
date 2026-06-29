import { ShopBrandCards } from "@/app/_components/shop/ShopBrandCards";
import { getBrandsCached, getCategoriesCached } from "@/lib/core/cached";

export async function HomeBrandsSection() {
	const [brands, categories] = await Promise.all([getBrandsCached(), getCategoriesCached()]);
	const visibleCount = brands.filter((brand) => brand.productCount > 0).length;
	if (visibleCount === 0) {
		return null;
	}

	const shopCategorySlug = categories.find((category) => category.isActive)?.slug ?? "ceiling-fans";

	return (
		<section className="cv-auto border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)]">
			<div className="app-section mx-auto max-w-[1440px] text-center md:px-6 lg:px-8">
				<div className="reveal mb-6 md:mb-8">
					<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)]">The Curators</p>
					<h2 className="mt-4 text-[2rem] font-light leading-[1] tracking-[-0.02em] text-[var(--color-ink-900)] md:text-[3rem]">
						Master Craftsmen
					</h2>
					<p className="mx-auto mt-4 max-w-prose text-[14px] leading-relaxed text-[var(--color-ink-600)] md:text-[15px] font-light">
						Explore collections from our trusted manufacturing partners.
					</p>
				</div>
				<ShopBrandCards brands={brands} centered linkCategorySlug={shopCategorySlug} />
			</div>
		</section>
	);
}
