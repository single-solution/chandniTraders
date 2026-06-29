/**
 * Shared bottom sentinel for admin list workspaces. Auto-loads the next page
 * when scrolled near (IntersectionObserver) with a visible "Load more" button
 * fallback and a retry affordance. Renders as an `<li>` so it sits validly at
 * the end of the `<ul>` scroll containers the lists use; pass `as="div"` for
 * non-list containers (e.g. the card grids).
 */
"use client";

import { useEffect, useRef } from "react";
import { Button } from "@store/ui";

interface InfiniteScrollSentinelProps {
	hasMore: boolean;
	isLoadingMore: boolean;
	hasError: boolean;
	onLoadMore: () => void;
	as?: "li" | "div";
}

const SENTINEL_ROOT_MARGIN = "300px 0px";

export function InfiniteScrollSentinel({ hasMore, isLoadingMore, hasError, onLoadMore, as = "li" }: InfiniteScrollSentinelProps) {
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node || !hasMore || hasError) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					onLoadMore();
				}
			},
			{ rootMargin: SENTINEL_ROOT_MARGIN },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [hasMore, hasError, onLoadMore]);

	if (!hasMore) {
		return null;
	}

	const content = (
		<div ref={sentinelRef} className="flex justify-center px-3 py-3">
			<Button variant="outline" size="sm" onClick={onLoadMore} isLoading={isLoadingMore}>
				{hasError ? "Retry" : "Load more"}
			</Button>
		</div>
	);

	if (as === "div") {
		return content;
	}
	return <li>{content}</li>;
}
