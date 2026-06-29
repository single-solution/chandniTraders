import Link from "next/link";

import { classNames } from "@store/shared";

import { Icon } from "@/components/shared/Icon";
import { shopCatalogPillClass } from "@/components/shared/shopCatalogPillStyles";
import { categoryHref } from "@/lib/catalog/productPaths";
import type { CategoryMeta } from "@/lib/core/queries";

interface ShopCategoryRailProps {
	activeSlug: string;
	categories: CategoryMeta[];
}

/**
 * Horizontal category switcher for `/shop/[category]`. Scales from a few
 * categories to many without pushing the product grid far down the page.
 */
export function ShopCategoryRail({ activeSlug, categories }: ShopCategoryRailProps) {
	const activeCategory = categories.find((category) => category.slug === activeSlug);

	return (
		<div className="min-w-0 flex-1">
			{activeCategory ? <h1 className="sr-only">{activeCategory.label}</h1> : null}

			<nav aria-label="Shop categories" className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 md:gap-2.5">
				{categories.map((category) => (
					<CategoryRailPill key={category.slug} category={category} isActive={category.slug === activeSlug} />
				))}
			</nav>
		</div>
	);
}

function CategoryRailPill({ category, isActive }: { category: CategoryMeta; isActive: boolean }) {
	const isAvailable = category.isActive;
	const className = classNames(
		shopCatalogPillClass(isActive),
		!isAvailable &&
			"cursor-not-allowed border-dashed bg-[var(--color-canvas-deep)]/50 text-[var(--color-ink-500)] opacity-80 hover:translate-y-0 hover:border-[var(--color-ink-200)] hover:bg-[var(--color-canvas-deep)]/50",
	);

	const inner = (
		<>
			<Icon node={category.iconNode} size={12} strokeWidth={2} className="shrink-0" />
			<span className="whitespace-nowrap">{category.label}</span>
			{!isAvailable && (
				<span className="rounded-full bg-[var(--color-ink-100)] px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-500)]">Soon</span>
			)}
		</>
	);

	const pill = !isAvailable ? (
		<span aria-disabled className={className}>
			{inner}
		</span>
	) : (
		<Link href={categoryHref(category.slug)} scroll={false} aria-current={isActive ? "page" : undefined} className={className}>
			{inner}
		</Link>
	);

	// Wrapper keeps pill interaction transitions isolated from layout churn.
	return <div className="flex shrink-0">{pill}</div>;
}

interface ShopCategoryHubGridProps {
	categories: CategoryMeta[];
}

/** Full category chooser for `/shop` when multiple categories exist. */
export function ShopCategoryHubGrid({ categories }: ShopCategoryHubGridProps) {
	return (
		<div className="reveal-scroll-list grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
			{categories.map((category) => (
				<div key={category.slug} className="reveal reveal-scroll reveal-rise h-full">
					<CategoryHubCard category={category} />
				</div>
			))}
		</div>
	);
}

function CategoryHubCard({ category }: { category: CategoryMeta }) {
	const isAvailable = category.isActive;
	const inner = (
		<div
			className={classNames(
				/* Concentric: inner icon well --radius-md (8) + p-5/p-6
           (20/24) → outer 28/32 ≈ --radius-3xl (32). */
				"flex h-full min-h-[7.5rem] flex-col items-start justify-between gap-4 rounded-[var(--radius-3xl)] border p-5 transition-[border-color,box-shadow,transform] duration-[var(--motion-fast)] md:min-h-[8.5rem] md:p-6",
				isAvailable
					? "border-[var(--color-ink-100)] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:border-[var(--color-accent-300)]/50 hover:shadow-[var(--shadow-md)]"
					: "cursor-not-allowed border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 opacity-75",
			)}
		>
			<span className="grid size-12 place-items-center rounded-[var(--radius-md)] border border-[var(--color-accent-400)]/30 bg-gradient-to-br from-[var(--color-accent-50)] to-[var(--color-accent-100)]/60 text-[var(--color-accent-800)] shadow-[var(--shadow-sm)]">
				<Icon node={category.iconNode} size={22} strokeWidth={2.2} />
			</span>
			<div className="min-w-0 w-full space-y-1">
				<p className="font-semibold tracking-tight text-[var(--color-ink-900)] md:text-[17px]">{category.label}</p>
				{!isAvailable && <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-500)]">Coming soon</span>}
			</div>
		</div>
	);

	if (!isAvailable) {
		return <div aria-disabled>{inner}</div>;
	}

	return (
		<Link href={categoryHref(category.slug)} className="group block h-full focus:outline-none">
			{inner}
		</Link>
	);
}
