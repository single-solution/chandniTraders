import type { OfferSchedule } from "./offerTypes";

const MINUTES_IN_HOUR = 60;

export type OfferUsageFields = {
	usageLimit?: number;
	usageCount?: number;
};

export function isOfferUsageExhausted(offer: OfferUsageFields): boolean {
	return typeof offer.usageLimit === "number" && offer.usageLimit > 0 && (offer.usageCount ?? 0) >= offer.usageLimit;
}

export function isOfferActiveSchedule(schedule: OfferSchedule, now = new Date()): boolean {
	if (schedule.startDate && now < new Date(schedule.startDate)) {
		return false;
	}
	if (schedule.endDate && now > new Date(schedule.endDate)) {
		return false;
	}

	if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
		if (!schedule.daysOfWeek.includes(now.getDay())) {
			return false;
		}
	}

	if (schedule.startTime || schedule.endTime) {
		const hours = now.getHours();
		const minutes = now.getMinutes();
		const currentMinutes = hours * MINUTES_IN_HOUR + minutes;

		if (schedule.startTime) {
			const [startH, startM] = schedule.startTime.split(":").map(Number);
			if (currentMinutes < startH * MINUTES_IN_HOUR + startM) {
				return false;
			}
		}

		if (schedule.endTime) {
			const [endH, endM] = schedule.endTime.split(":").map(Number);
			if (currentMinutes > endH * MINUTES_IN_HOUR + endM) {
				return false;
			}
		}
	}

	return true;
}

export function isOfferEligible(offer: OfferUsageFields & { schedule: OfferSchedule }, now = new Date()): boolean {
	return isOfferActiveSchedule(offer.schedule, now) && !isOfferUsageExhausted(offer);
}
