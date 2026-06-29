/** Days in an ISO week — used when stepping back one full week. */
export const DAYS_PER_WEEK = 7;
/** Denominator for percent calculations (always 100). */
export const PERCENT_DENOMINATOR = 100;

export function startOfDay(date: Date): Date {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

/** Number of days to subtract from `getDay()` (Sun=0…Sat=6) to land on Monday. */
const MONDAY_OFFSET = 6;

export function startOfWeek(date: Date): Date {
	const next = startOfDay(date);
	const daysSinceMonday = (next.getDay() + MONDAY_OFFSET) % DAYS_PER_WEEK;
	next.setDate(next.getDate() - daysSinceMonday);
	return next;
}

export function startOfMonth(date: Date): Date {
	const next = startOfDay(date);
	next.setDate(1);
	return next;
}

export function startOfYear(date: Date): Date {
	const next = startOfDay(date);
	next.setMonth(0, 1);
	return next;
}
