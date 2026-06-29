import { DECIMAL_RADIX, MAX_INPUT_LENGTH, MAX_LONG_TEXT_LENGTH } from "./constants";

/**
 * Server-side input validators. Client-side validation is for UX only — every
 * value reaching a handler MUST pass through these (or an equivalent check)
 * before it influences the database or business logic.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Practical upper bound on email length — RFC 5321 caps at 254 chars total
 *  but we accept the more permissive 320 (64-char local + 1 + 255-char domain). */
const MAX_EMAIL_CHARS = 320;

/** Minimum password length we accept on sign-in / change-password forms. */
const MIN_PASSWORD_CHARS = 8;
/** Hard cap on password length to prevent DoS via outsized bcrypt inputs. */
const MAX_PASSWORD_CHARS = 128;

interface StringOptions {
	/** Field label for the error message. */
	label: string;
	/** Whether the field is required (default: true). */
	required?: boolean;
	/** Inclusive minimum length. */
	min?: number;
	/** Inclusive maximum length (default: `MAX_INPUT_LENGTH`). */
	max?: number;
}

const DEFAULT_REQUIRED_MIN = 1;
const DEFAULT_OPTIONAL_MIN = 0;

/**
 * Validate a string field. Returns the trimmed value, or an error message.
 */
export function validateString(value: unknown, options: StringOptions): string | { error: string } {
	const { label, required = true, min = required ? DEFAULT_REQUIRED_MIN : DEFAULT_OPTIONAL_MIN, max = MAX_INPUT_LENGTH } = options;

	if (!required && (value === undefined || value === null)) {
		return "";
	}
	if (typeof value !== "string") {
		return { error: `${label} must be a string.` };
	}

	const trimmed = value.trim();
	if (required && trimmed.length === 0) {
		return { error: `${label} is required.` };
	}
	if (trimmed.length < min) {
		return { error: `${label} must be at least ${min} characters.` };
	}
	if (trimmed.length > max) {
		return { error: `${label} must be at most ${max} characters.` };
	}

	return trimmed;
}

/** Validate a long-form text field (descriptions, notes). */
export function validateLongText(value: unknown, label: string, required = true) {
	return validateString(value, { label, required, max: MAX_LONG_TEXT_LENGTH });
}

/** Validate an email address. Returns the lowercased / trimmed value. */
export function validateEmail(value: unknown, label = "Email"): string | { error: string } {
	const result = validateString(value, { label, max: MAX_EMAIL_CHARS });
	if (typeof result !== "string") {
		return result;
	}
	const normalized = result.toLowerCase();
	if (!EMAIL_REGEX.test(normalized)) {
		return { error: `${label} must be a valid email address.` };
	}
	return normalized;
}

/**
 * Validate password strength. Tuned for an admin console — at least 8 chars,
 * with at least one letter and one digit. Tighten per security review.
 */
export function validatePassword(value: unknown, label = "Password"): string | { error: string } {
	if (typeof value !== "string") {
		return { error: `${label} is required.` };
	}
	if (value.length < MIN_PASSWORD_CHARS) {
		return { error: `${label} must be at least ${MIN_PASSWORD_CHARS} characters.` };
	}
	if (value.length > MAX_PASSWORD_CHARS) {
		return { error: `${label} must be at most ${MAX_PASSWORD_CHARS} characters.` };
	}
	if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
		return { error: `${label} must contain a letter and a number.` };
	}
	return value;
}

const MIN_SAFE_INTEGER = 0;

/**
 * Parse a positive integer query string parameter with a fallback.
 * Returns `fallback` for non-numeric, negative, or NaN values.
 */
export function safeParseInt(input: string | null | undefined, fallback: number): number {
	if (input === null || input === undefined) {
		return fallback;
	}
	const parsed = Number.parseInt(input, DECIMAL_RADIX);
	if (Number.isNaN(parsed) || parsed < MIN_SAFE_INTEGER) {
		return fallback;
	}
	return parsed;
}

/** Type guard for distinguishing successful validation from an error result. */
export function isValidationError(result: unknown): result is { error: string } {
	return typeof result === "object" && result !== null && "error" in result;
}

/**
 * Narrow a freshly-parsed JSON value to `unknown[]` so subsequent `.filter`
 * callbacks can type-narrow each element explicitly. Centralised because
 * TypeScript's `Array.isArray` narrows to `any[]` (which silently disables
 * checks inside the callback) — wrapping it here keeps each call-site safe
 * without sprinkling individual `as unknown[]` casts across route handlers.
 */
export function toUnknownArray(value: unknown): unknown[] {
	return Array.isArray(value) ? (value as unknown[]) : [];
}
