/**
 * Dashboard performance period types + labels.
 *
 * Kept separate from `dashboardStats.ts` so the client-side period
 * selector can import them without pulling mongoose / server-only code
 * into the browser bundle.
 */

export const PERFORMANCE_RANGES = ["today", "week", "month", "year"] as const;
export type PerformanceRange = (typeof PERFORMANCE_RANGES)[number];

export const PERFORMANCE_COMPARES = ["previous", "last_year"] as const;
export type PerformanceCompare = (typeof PERFORMANCE_COMPARES)[number];

export const PERFORMANCE_RANGE_LABELS: Record<PerformanceRange, string> = {
	today: "Today",
	week: "This week",
	month: "This month",
	year: "This year",
};

export function isPerformanceRange(value: string | undefined): value is PerformanceRange {
	return value !== undefined && (PERFORMANCE_RANGES as readonly string[]).includes(value);
}

export function isPerformanceCompare(value: string | undefined): value is PerformanceCompare {
	return value !== undefined && (PERFORMANCE_COMPARES as readonly string[]).includes(value);
}
