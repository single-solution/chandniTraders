"use client";

import Link from "next/link";
import { LayoutGrid, Check } from "lucide-react";

import { classNames, catalogBrandLogoUrl, type Brand } from "@store/shared";

import { categoryHref } from "@/lib/catalog/productPaths";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";

interface ShopBrandCardsProps {
	brands: Brand[];
	className?: string;
	centered?: boolean;
	/** When set, cards link into this category with a brand filter instead of toggling URL params on the current page. */
	linkCategorySlug?: string;
}

/** Circle ≈ half the width of a product card in the listing grid (2/4/5 cols). */
const BRAND_CARD_WIDTH_CLASS =
	"w-[calc((100%-1rem)/3.5)] md:w-[calc((100%-1.5rem)/5)] lg:w-[calc((100%-2rem)/7)] xl:w-[calc((100%-2.5rem)/9)] max-w-[12rem] max-md:min-w-[5.5rem]";

/** Circle brand picker — always uses canonical manufacturer logos, never product photos. */
export function ShopBrandCards({ brands, className, centered = false, linkCategorySlug }: ShopBrandCardsProps) {
	const filterApi = useFilterParams();
	const selectedSlugs = linkCategorySlug ? [] : filterApi.getMulti(FILTER_PARAM_KEYS.brands);
	const visibleBrands = brands.filter((brand) => {
		const logoUrl = catalogBrandLogoUrl(brand.slug);
		return Boolean(logoUrl); // Temporarily show all brands even if productCount is 0
	});

	if (visibleBrands.length === 0) {
		return null;
	}

	return (
		<nav aria-label="Shop by brand" className={classNames("min-w-0", centered && "text-center", className)}>
			<div
				className={classNames(
					"-mx-1 flex gap-4 px-1 pb-2 md:gap-6",
					centered ? "flex-wrap items-start justify-center [scrollbar-width:thin] max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:no-scrollbar" : "overflow-x-auto [scrollbar-width:thin] max-md:snap-x max-md:snap-mandatory max-md:no-scrollbar",
				)}
			>
				{/* "All" Brand Card */}
				{(() => {
					const isAllActive = !linkCategorySlug && selectedSlugs.length === 0;
					const topBrandLogos = visibleBrands.slice(0, 4).map(b => catalogBrandLogoUrl(b.slug)).filter(Boolean) as string[];
					
					const allCardBody = (
						<div className="relative w-full">
							<span
								className={classNames(
									"relative grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 p-[4%] shadow-[var(--shadow-md)] transition-all",
									isAllActive
										? "border-[var(--color-accent-500)] bg-[var(--color-ink-900)] ring-[3px] ring-[var(--color-accent-200)]"
										: "border-[var(--color-ink-100)] bg-[var(--color-ink-800)] group-hover:border-[var(--color-accent-400)] group-hover:shadow-[var(--shadow-lg)]",
								)}
							>
								{topBrandLogos.length > 0 && (
									<div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-2 opacity-30 grayscale transition-all group-hover:opacity-50 group-hover:grayscale-0">
										{topBrandLogos.map((url, i) => (
											<div key={i} className="flex items-center justify-center">
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img src={url} alt="" className="max-h-full max-w-full object-contain mix-blend-screen invert" loading="lazy" />
											</div>
										))}
									</div>
								)}
								{isAllActive ? (
									<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-[var(--color-ink-900)]/60 backdrop-blur-[2px]">
										<Check size={20} strokeWidth={3} className="text-[var(--color-accent-500)]" />
										<span className="text-[9px] font-black uppercase tracking-widest text-white">All Brands</span>
									</div>
								) : (
									<div className="absolute inset-0 flex items-center justify-center">
										<span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm backdrop-blur-md transition-colors">
											All Brands
										</span>
									</div>
								)}
							</span>
						</div>
					);
					const cardClassName = classNames(
						"tap group flex shrink-0 flex-col items-center gap-3 text-center transition-opacity max-md:snap-center",
						BRAND_CARD_WIDTH_CLASS,
						!linkCategorySlug && filterApi.isPending && "opacity-60",
					);

					if (linkCategorySlug) {
						return (
							<Link
								key="all-brands"
								href={categoryHref(linkCategorySlug)}
								className={cardClassName}
							>
								{allCardBody}
							</Link>
						);
					}

					return (
						<button
							key="all-brands"
							type="button"
							disabled={filterApi.isPending}
							onClick={() => {
								const next = new URLSearchParams(filterApi.params.toString());
								next.delete(FILTER_PARAM_KEYS.brands);
								filterApi.replaceParams(next);
							}}
							aria-pressed={isAllActive}
							className={cardClassName}
						>
							{allCardBody}
						</button>
					);
				})()}

				{visibleBrands.map((brand) => {
					const logoUrl = catalogBrandLogoUrl(brand.slug);
					if (!logoUrl) {
						return null;
					}
					const isActive = !linkCategorySlug && selectedSlugs.includes(brand.slug);
					const cardBody = (
						<div className="relative w-full">
							<span
								className={classNames(
									"relative grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 bg-white p-[4%] shadow-[var(--shadow-md)] transition-all",
									isActive
										? "border-[var(--color-accent-500)] ring-[3px] ring-[var(--color-accent-200)]"
										: "border-[var(--color-ink-100)] group-hover:border-[var(--color-accent-400)] group-hover:shadow-[var(--shadow-lg)]",
								)}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={logoUrl} alt={brand.name} className={classNames("max-h-full max-w-full object-contain transition-all", isActive && "opacity-30 grayscale")} loading="lazy" decoding="async" />
								{isActive && (
									<div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-ink-900)]/40 backdrop-blur-[2px]">
										<span className="grid size-8 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)] shadow-md">
											<Check size={18} strokeWidth={3} />
										</span>
									</div>
								)}
							</span>
						</div>
					);
					const cardClassName = classNames(
						"tap group flex shrink-0 flex-col items-center gap-3 text-center transition-opacity max-md:snap-center",
						BRAND_CARD_WIDTH_CLASS,
						!linkCategorySlug && filterApi.isPending && "opacity-60",
					);

					if (linkCategorySlug) {
						return (
							<Link
								key={brand.slug}
								href={`${categoryHref(linkCategorySlug)}?brand=${encodeURIComponent(brand.slug)}`}
								className={cardClassName}
							>
								{cardBody}
							</Link>
						);
					}

					return (
						<button
							key={brand.slug}
							type="button"
							disabled={filterApi.isPending}
							onClick={() => filterApi.toggleInMulti(FILTER_PARAM_KEYS.brands, brand.slug)}
							aria-pressed={isActive}
							className={cardClassName}
						>
							{cardBody}
						</button>
					);
				})}
			</div>
		</nav>
	);
}
