/**
 * Pakistan phone-number normalisation helpers.
 *
 * Customers enter phone numbers in many forms — "+92 320 4862403",
 * "0320-4862403", "923204862403", etc. We don't enforce a single format on
 * input (it would frustrate users) but we *do* need a canonical form for
 * comparing two numbers — e.g. matching an order's snapshot phone with the
 * one a tracker types in.
 *
 * Strategy: keep the trailing 10 digits ("3204862403"). That's the unique
 * mobile portion in PK and is robust to any common prefix (`+92`, `92`,
 * `0`).
 */

/**
 * Pakistan mobile numbers always end in a 10-digit subscriber portion.
 * The `+92`, `92`, or leading `0` are interchangeable prefixes that we
 * strip when computing identity.
 */
const PK_MOBILE_DIGITS = 10;

/** Pakistan country calling code in E.164 form. */
const PK_COUNTRY_CODE = "+92";

/** Strip every non-digit character from `input` and return the remainder. */
function digitsOnly(input: string): string {
	return input.replace(/\D+/g, "");
}

/**
 * Returns the last 10 digits of the provided string, or `null` if there
 * aren't 10 digits available. Use this as the canonical phone identity.
 */
export function phoneFingerprint(input: string | null | undefined): string | null {
	if (!input) {
		return null;
	}
	const digits = digitsOnly(input);
	if (digits.length < PK_MOBILE_DIGITS) {
		return null;
	}
	return digits.slice(-PK_MOBILE_DIGITS);
}

/**
 * Normalise any accepted Pakistan phone format to canonical E.164 — `+92`
 * followed by the 10-digit subscriber portion. Accepts every common shape the
 * same number can be typed in: "+92 321 4232028", "0321-4232028",
 * "0321 4232 028", "923214232028", "3214232028", etc. Returns `null` when
 * fewer than 10 digits are present.
 *
 * This is the single canonical form persisted on every write path (admin
 * customer create, storefront OTP upsert) so a customer resolves to the same
 * record no matter how they type their number.
 */
export function normalizePhoneNumber(input: string | null | undefined): string | null {
	const fingerprint = phoneFingerprint(input);
	if (!fingerprint) {
		return null;
	}
	return `${PK_COUNTRY_CODE}${fingerprint}`;
}

/**
 * True if two raw phone strings reference the same number, even when one
 * is "+92 320 4862403" and the other is "0320-4862403".
 */
export function sameNumber(first: string | null | undefined, second: string | null | undefined): boolean {
	const firstFingerprint = phoneFingerprint(first);
	const secondFingerprint = phoneFingerprint(second);
	return Boolean(firstFingerprint && secondFingerprint && firstFingerprint === secondFingerprint);
}

const WHATSAPP_MIN_DIGITS = 10;
const WHATSAPP_MAX_DIGITS = 15;

/** Digits-only international form for WhatsApp deep links (e.g. `923204862403`). */
export function normalizeWhatsappNumber(input: string): string {
	return input.replace(/\D/g, "");
}

export function isValidWhatsappNumber(digits: string): boolean {
	return digits.length >= WHATSAPP_MIN_DIGITS && digits.length <= WHATSAPP_MAX_DIGITS;
}
