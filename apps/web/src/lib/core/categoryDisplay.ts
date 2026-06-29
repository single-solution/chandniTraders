/** Homepage teaser — show this many category cards before "Browse all". */
export const HOME_FEATURED_CATEGORY_COUNT = 6;

/** At this count, switch from equal-width rows to the dense multi-column grid. */
const HOME_CATEGORY_DENSE_GRID_THRESHOLD = 5;

export function formatCategorySectionTitle(labels: string[]): string {
	if (labels.length === 0) {
		return "Every category.";
	}
	if (labels.length <= 3) {
		return labels.map((label) => `${label}.`).join(" ");
	}
	return `${labels.slice(0, 2).join(". ")}. & more.`;
}

export function shouldShowBrowseAllCategories(totalCount: number): boolean {
	return totalCount > HOME_FEATURED_CATEGORY_COUNT;
}

/**
 * Home category band — few tiles share the row evenly; many use the dense
 * storefront grid (2 → 3 → 4 → 5 columns by breakpoint).
 */
export function getHomeCategoryGridClass(count: number, variant: "mobile" | "desktop" = "desktop"): string {
	if (count <= 0) {
		return variant === "mobile" ? "grid grid-cols-1 gap-2.5" : "grid grid-cols-1 gap-4 xl:gap-5";
	}

	if (variant === "mobile") {
		if (count <= 3) {
			return "grid grid-cols-1 gap-2.5";
		}
		if (count === 4) {
			return "grid grid-cols-2 gap-2.5";
		}
		return "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4";
	}

	if (count < HOME_CATEGORY_DENSE_GRID_THRESHOLD) {
		if (count === 1) {
			return "grid grid-cols-1 gap-4 xl:gap-5";
		}
		if (count === 2) {
			return "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5";
		}
		if (count === 3) {
			return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5";
		}
		return "grid grid-cols-2 gap-4 lg:grid-cols-4 xl:gap-5";
	}

	return "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5";
}
