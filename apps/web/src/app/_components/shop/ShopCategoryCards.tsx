"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { classNames } from "@store/shared";
import { shopCatalogPillClass } from "@/components/shared/shopCatalogPillStyles";
import { catalogRootHref, categoryHref } from "@/lib/catalog/productPaths";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";
import type { CategoryMeta } from "@/lib/core/queries";

interface ShopCategoryCardsProps {
	categories: CategoryMeta[];
	activeSlug: string;
	className?: string;
	centered?: boolean;
}

/** Pill category picker — matches the pill style without icons. */
export function ShopCategoryCards({ categories, activeSlug, className, centered = false }: ShopCategoryCardsProps) {
	const pathname = usePathname();
	const filterApi = useFilterParams();
	const visibleCategories = categories.filter((category) => category.isActive);
	const homeCategorySlug = visibleCategories[0]?.slug ?? "";
	const isHomeCatalog = pathname === catalogRootHref();

	if (visibleCategories.length === 0) {
		return null;
	}

	const effectiveActiveSlug = activeSlug || homeCategorySlug;

	function selectHomeCategory(slug: string) {
		const next = new URLSearchParams(filterApi.params.toString());
		next.delete(FILTER_PARAM_KEYS.brands);
		next.delete(FILTER_PARAM_KEYS.page);
		next.set(FILTER_PARAM_KEYS.category, slug);
		filterApi.replaceParams(next);
	}

	return (
		<nav aria-label="Shop by category" className={classNames("min-w-0", centered && "text-center", className)}>
			<div
				className={classNames(
					"-mx-1 flex gap-2.5 px-1 pb-2 md:gap-3",
					centered ? "flex-wrap items-center justify-center [scrollbar-width:thin]" : "overflow-x-auto [scrollbar-width:thin]",
				)}
			>
				{visibleCategories.map((category) => {
					const isActive = category.slug === effectiveActiveSlug;
					const pillClassName = classNames(shopCatalogPillClass(isActive), "whitespace-nowrap transition-colors", isHomeCatalog && filterApi.isPending && "opacity-60");

					if (isHomeCatalog) {
						return (
							<button
								key={category.slug}
								type="button"
								disabled={filterApi.isPending}
								aria-pressed={isActive}
								onClick={() => selectHomeCategory(category.slug)}
								className={pillClassName}
							>
								{category.label}
							</button>
						);
					}

					return (
						<Link key={category.slug} href={categoryHref(category.slug)} className={pillClassName}>
							{category.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
