import { HOURS_PER_DAY, MINUTES_PER_HOUR, MS_PER_MINUTE } from "./constants";

const DAYS_PER_WEEK = 7;
/** Approximate days/months used for "Xmo ago" / "Xy ago" rendering only. */
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;
/** Switch from "Xw" to "Xmo" once the gap is at least this many weeks. */
const WEEKS_BEFORE_MONTHS_LABEL = 5;

const MS_PER_DAY = MS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

/** Render a rupee amount with thousands separators, e.g. `Rs 12,500`. */
export function formatPrice(rupees: number): string {
	const formatted = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
	}).format(rupees);
	return `Rs ${formatted}`;
}

/** Render an offer-style countdown ("Ends in 3 days", "Ends today", …). */
export function formatRelativeDate(isoString: string): string {
	const target = new Date(isoString);
	const now = new Date();
	const diffMs = target.getTime() - now.getTime();
	const diffDays = Math.round(diffMs / MS_PER_DAY);

	if (diffDays > 1) {
		return `Ends in ${diffDays} days`;
	}
	if (diffDays === 1) {
		return "Ends tomorrow";
	}
	if (diffDays === 0) {
		return "Ends today";
	}
	return "Expired";
}

/**
 * Render a relative "time ago" string ("just now", "5m ago", "3d ago", …).
 * Pass `referenceIso` to anchor the diff to a fixed instant — useful for SSR
 * so server- and client-rendered output match.
 */
export function formatTimeAgo(isoString: string, referenceIso?: string): string {
	const target = new Date(isoString).getTime();
	const reference = referenceIso ? new Date(referenceIso).getTime() : Date.now();
	const diffMs = reference - target;
	if (Number.isNaN(diffMs)) {
		return "";
	}

	const diffMinutes = Math.round(diffMs / MS_PER_MINUTE);
	if (diffMinutes < 1) {
		return "just now";
	}
	if (diffMinutes < MINUTES_PER_HOUR) {
		return `${diffMinutes}m ago`;
	}

	const diffHours = Math.round(diffMinutes / MINUTES_PER_HOUR);
	if (diffHours < HOURS_PER_DAY) {
		return `${diffHours}h ago`;
	}

	const diffDays = Math.round(diffHours / HOURS_PER_DAY);
	if (diffDays < DAYS_PER_WEEK) {
		return `${diffDays}d ago`;
	}

	const diffWeeks = Math.round(diffDays / DAYS_PER_WEEK);
	if (diffWeeks < WEEKS_BEFORE_MONTHS_LABEL) {
		return `${diffWeeks}w ago`;
	}

	const diffMonths = Math.round(diffDays / DAYS_PER_MONTH);
	if (diffMonths < MONTHS_PER_YEAR) {
		return `${diffMonths}mo ago`;
	}

	const diffYears = Math.round(diffDays / DAYS_PER_YEAR);
	return `${diffYears}y ago`;
}

const STOREFRONT_DATE_FORMATTER = new Intl.DateTimeFormat("en-PK", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const STOREFRONT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-PK", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

/** "12 Mar 2026" — used across customer-facing date displays. */
export function formatStorefrontDate(isoString: string): string {
	return STOREFRONT_DATE_FORMATTER.format(new Date(isoString));
}

/** "12 Mar, 9:45 PM" — used for tighter timeline / event displays. */
export function formatStorefrontDateTime(isoString: string): string {
	return STOREFRONT_DATE_TIME_FORMATTER.format(new Date(isoString));
}
