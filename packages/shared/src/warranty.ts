/** Display grouping — 30-day months for customer-facing copy. */
export const WARRANTY_DAYS_PER_MONTH = 30;

export interface WarrantyCarrier {
	warrantyDays?: number;
}

export function resolveWarrantyDays(carrier: WarrantyCarrier): number {
	if (typeof carrier.warrantyDays === "number" && Number.isFinite(carrier.warrantyDays)) {
		return Math.max(0, Math.floor(carrier.warrantyDays));
	}
	return 0;
}

/**
 * Human-readable warranty length.
 * Under one month: days only. Otherwise: months + optional remainder days.
 */
export function formatWarrantyPeriod(totalDays: number): string {
	const days = Math.max(0, Math.floor(totalDays));
	if (days === 0) {
		return "No warranty";
	}
	if (days < WARRANTY_DAYS_PER_MONTH) {
		return days === 1 ? "1 day" : `${days} days`;
	}
	const months = Math.floor(days / WARRANTY_DAYS_PER_MONTH);
	const remainder = days % WARRANTY_DAYS_PER_MONTH;
	const monthLabel = months === 1 ? "1 month" : `${months} months`;
	if (remainder === 0) {
		return monthLabel;
	}
	const dayLabel = remainder === 1 ? "1 day" : `${remainder} days`;
	return `${monthLabel} ${dayLabel}`;
}
