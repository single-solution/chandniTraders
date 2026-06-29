/**
 * Shared chat input validators. The same regex + length rules run on the
 * storefront client (so "Full name" validation feedback is instant) and
 * on the storefront API (so a manipulated client can't sneak past).
 */

import { CHAT_CUSTOMER_NAME_MAX, CHAT_CUSTOMER_NAME_MIN, CHAT_CUSTOMER_NAME_REGEX, CHAT_MESSAGE_BODY_MAX } from "./types";

export interface FieldError {
	error: string;
	field: string;
}

export function validateCustomerName(value: unknown): string | FieldError {
	if (typeof value !== "string") {
		return { error: "Full name is required.", field: "customerName" };
	}
	const trimmed = value.trim();
	if (trimmed.length < CHAT_CUSTOMER_NAME_MIN) {
		return {
			error: `Full name must be at least ${CHAT_CUSTOMER_NAME_MIN} characters.`,
			field: "customerName",
		};
	}
	if (trimmed.length > CHAT_CUSTOMER_NAME_MAX) {
		return {
			error: `Full name must be at most ${CHAT_CUSTOMER_NAME_MAX} characters.`,
			field: "customerName",
		};
	}
	if (!CHAT_CUSTOMER_NAME_REGEX.test(trimmed)) {
		return {
			error: "Full name can only contain letters, spaces, dots, hyphens, and apostrophes.",
			field: "customerName",
		};
	}
	return trimmed;
}

export function validateMessageBody(value: unknown): string | FieldError {
	if (typeof value !== "string") {
		return { error: "Message is required.", field: "body" };
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return { error: "Message cannot be empty.", field: "body" };
	}
	if (trimmed.length > CHAT_MESSAGE_BODY_MAX) {
		return {
			error: `Message must be at most ${CHAT_MESSAGE_BODY_MAX} characters.`,
			field: "body",
		};
	}
	return trimmed;
}

export function isFieldError(value: unknown): value is FieldError {
	return typeof value === "object" && value !== null && "error" in value && "field" in value;
}
