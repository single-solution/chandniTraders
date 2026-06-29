"use client";

import type { Product } from "@store/shared";

import { hasActiveListingFilters } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";

import { ProductCard } from "./ProductCard";
import { useSwapAnimation } from "@/components/shared/motion/useSwapAnimation";

interface ShopProductGridProps {
	products: Product[];
	categoryLabel: string;
	/**
	 * Number of leading cards whose hero image should load with high
	 * priority (sets `priority` on the `<Image>` so Next.js emits a
	 * `<link rel="preload" fetchpriority="high">` and skips the default
	 * lazy loader). The LCP candidate is almost always the first card —
	 * preloading additional images would split bandwidth and slow it down
	 * — so the safe default is the mobile first row (2 cards). Surfaces
	 * with a wider above-the-fold layout (e.g. a 4-column desktop hero
	 * rail) can pass a higher count.
	 */
	priorityCount?: number;
	/**
	 * Column/gap utilities for the grid container. Defaults to the category
	 * listing layout; search and deals pass their own so wiring them through
	 * the shared feed preserves each surface's exact column counts.
	 */
	gridClassName?: string;
}

const DEFAULT_PRIORITY_COUNT = 2;
const DEFAULT_GRID_CLASS = "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 md:gap-6 xl:grid-cols-4 xl:gap-7";

export function ShopProductGrid({ products, categoryLabel, priorityCount = DEFAULT_PRIORITY_COUNT, gridClassName = DEFAULT_GRID_CLASS }: ShopProductGridProps) {
	const { params, clearAll } = useFilterParams();
	const filtersActive = hasActiveListingFilters(params);
	const listingKey = params.toString();
	const isListingSwap = useSwapAnimation(listingKey);

	if (products.length === 0) {
		return <ShopListingEmptyState categoryLabel={categoryLabel} filtersActive={filtersActive} isListingSwap={isListingSwap} onClearFilters={clearAll} />;
	}

	return (
		<div className={`reveal-scroll-list ${gridClassName}${isListingSwap ? " listing-swap" : ""}`}>
			{products.map((product, index) => (
				<div key={product.id} className="reveal reveal-rise reveal-scroll h-full">
					<ProductCard product={product} priority={index < priorityCount} />
				</div>
			))}
		</div>
	);
}

function ShopListingEmptyState({
	categoryLabel,
	filtersActive,
	isListingSwap,
	onClearFilters,
}: {
	categoryLabel: string;
	filtersActive: boolean;
	isListingSwap: boolean;
	onClearFilters: () => void;
}) {
	return (
		<div
			role="status"
			className={`reveal rounded-[var(--radius-lg)] border border-dashed border-[var(--color-accent-200)]/60 bg-gradient-to-b from-[var(--color-accent-50)]/40 to-[var(--color-canvas-deep)]/30 px-6 py-14 text-center${isListingSwap ? " listing-swap" : ""}`}
		>
			<p className="text-sm font-semibold text-[var(--color-ink-900)]">
				{filtersActive ? "No more products match your selection" : `No ${categoryLabel.toLowerCase()} in stock right now`}
			</p>
			<p className="mx-auto mt-2 max-w-prose text-[13px] leading-snug text-[var(--color-ink-500)]">
				{filtersActive ? "Try clearing a filter or choosing a different brand." : "Check back soon — we add new stock regularly."}
			</p>
			{filtersActive ? (
				<button
					type="button"
					onClick={onClearFilters}
					className="tap focus-ring mt-5 inline-flex h-9 items-center rounded-[var(--radius-full)] bg-[var(--color-accent-500)] px-4 text-[13px] font-semibold text-[var(--color-ink-900)] transition-colors hover:bg-[var(--color-accent-600)]"
				>
					Clear filters
				</button>
			) : null}
		</div>
	);
}
