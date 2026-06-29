/**
 * Infinite-scroll product feed shared by the category listing, search
 * results, and deals surfaces. Wraps the presentational `ShopProductGrid`
 * (so the reveal cascade + filter-swap animation are untouched) over an
 * accumulating product list, and drives `GET /api/products` via
 * `useInfiniteProducts`. Auto-loads the next page when the bottom sentinel
 * nears the viewport (IntersectionObserver) with a visible "Load more"
 * button fallback and an end-of-results marker.
 */
"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import { ResultsCountBar } from "./ResultsCountBar";
import { ShopProductGrid } from "./ShopProductGrid";
import { useInfiniteProducts } from "@/lib/core/useInfiniteProducts";
import type { ProductPage } from "@/lib/core";

interface ShopProductFeedProps {
	initialPage: ProductPage;
	categoryLabel: string;
	apiParams: Record<string, string>;
	priorityCount?: number;
	gridClassName?: string;
	/** Render a live "Showing 1–N of total" bar above the grid (search surface). */
	showResultsCount?: boolean;
}

/** How far above the viewport the sentinel pre-fetches the next page. */
const SENTINEL_ROOT_MARGIN = "600px 0px";

export function ShopProductFeed({ initialPage, categoryLabel, apiParams, priorityCount, gridClassName, showResultsCount = false }: ShopProductFeedProps) {
	const { products, total, hasMore, isLoadingMore, hasError, loadMore } = useInfiniteProducts({
		initial: initialPage,
		apiParams,
	});

	const sentinelRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node || !hasMore || hasError) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					loadMore();
				}
			},
			{ rootMargin: SENTINEL_ROOT_MARGIN },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [hasMore, hasError, loadMore]);

	return (
		<div className="space-y-6">
			{showResultsCount ? <ResultsCountBar total={total} page={1} pageSize={products.length} /> : null}

			<ShopProductGrid products={products} categoryLabel={categoryLabel} priorityCount={priorityCount} gridClassName={gridClassName} />

			{hasMore ? (
				<div ref={sentinelRef} className="reveal-fade flex justify-center pt-2">
					<button
						type="button"
						onClick={loadMore}
						disabled={isLoadingMore}
						className="tap focus-ring inline-flex h-10 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-ink-800)] transition-colors hover:border-[var(--color-ink-300)] disabled:opacity-60"
					>
						{isLoadingMore ? (
							<>
								<Loader2 size={15} className="animate-spin" aria-hidden />
								Loading…
							</>
						) : hasError ? (
							"Retry"
						) : (
							"Load more"
						)}
					</button>
				</div>
			) : initialPage.pageCount > 1 && products.length > 0 ? (
				<p className="reveal-fade pt-2 text-center text-[13px] text-[var(--color-ink-400)]">You&rsquo;ve reached the end</p>
			) : null}
		</div>
	);
}
