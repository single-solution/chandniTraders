/**
 * Cross-cutting compile-time constants — UI option lists, backend limits,
 * and the WhatsApp deep-link builder.
 *
 * Anything brand-specific (site name, contact phone numbers, social links,
 * policy thresholds) lives in `storeSettings.ts` and is read at runtime via
 * `getStoreSettings()` (server) or `useStoreSettings()` (client) — never
 * imported from this file.
 */

/** Build a WhatsApp deep-link for a given message + WhatsApp number. */
export function buildWhatsAppLink(message: string, whatsappNumber: string): string {
	return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

// ─── Storefront UI options ──────────────────────────────────────────────────

/** Stable IDs / labels for checkout payment chips. */
export const PAYMENT_METHOD_IDS = ["bank-transfer", "cod", "card"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export interface PaymentMethodOption {
	id: PaymentMethodId;
	label: string;
	note: string;
}

export interface PaymentMethodSettings {
	codSurchargePercent: number;
	paymentBankTransferEnabled?: boolean;
	paymentBankTransferNote?: string;
	paymentCardEnabled?: boolean;
	paymentCodEnabled?: boolean;
	paymentCardNote?: string;
	paymentCodNote?: string;
	/** When false, card chip is hidden (no PK gateway configured). Set server-side only. */
	cardCheckoutReady?: boolean;
	bankAccountNumber?: string;
	bankIban?: string;
}

/**
 * Build checkout payment options from admin settings.
 * COD note can include the live cash surcharge % when configured.
 */
function hasBankTransferDetails(settings: PaymentMethodSettings): boolean {
	return Boolean(settings.bankAccountNumber?.trim() || settings.bankIban?.trim());
}

export function getPaymentMethods(settings: PaymentMethodSettings): readonly PaymentMethodOption[] {
	const codSurchargePercent = Math.max(0, settings.codSurchargePercent);
	const all: Array<PaymentMethodOption & { enabled: boolean }> = [
		{
			id: "bank-transfer",
			label: "Bank transfer",
			note: settings.paymentBankTransferNote?.trim() || "Transfer online — send payment screenshot on WhatsApp",
			enabled: (settings.paymentBankTransferEnabled ?? true) && hasBankTransferDetails(settings),
		},
		{
			id: "cod",
			label: "Cash on delivery",
			note:
				settings.paymentCodNote?.trim() ||
				(codSurchargePercent > 0 ? `+${codSurchargePercent}% handling on cash orders` : "Pay when you receive your order"),
			enabled: settings.paymentCodEnabled ?? true,
		},
		{
			id: "card",
			label: "Pay online",
			note: settings.paymentCardNote?.trim() || "Cards, JazzCash, easypaisa, Raast (when enabled)",
			enabled: (settings.paymentCardEnabled ?? false) && (settings.cardCheckoutReady ?? false),
		},
	];
	return all.filter((method) => method.enabled).map(({ enabled: _enabled, ...rest }) => rest);
}

const PAYMENT_METHOD_FALLBACK_LABELS: Record<PaymentMethodId, string> = {
	"bank-transfer": "Bank transfer",
	card: "Pay online",
	cod: "Cash on delivery",
};

export function getPaymentMethodLabel(id: PaymentMethodId | string): string {
	if ((PAYMENT_METHOD_IDS as readonly string[]).includes(id)) {
		return PAYMENT_METHOD_FALLBACK_LABELS[id as PaymentMethodId];
	}
	return id.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export const STORAGE_OPTIONS = [64, 128, 256, 512, 1024] as const;

export const RAM_OPTIONS = [4, 6, 8, 12, 16] as const;

// ─── Time conversion units ──────────────────────────────────────────────────

/** Milliseconds in one second. */
export const MS_PER_SECOND = 1_000;
/** Seconds in one minute. */
export const SECONDS_PER_MINUTE = 60;
/** Minutes in one hour. */
export const MINUTES_PER_HOUR = 60;
/** Hours in one day. */
export const HOURS_PER_DAY = 24;

/** Milliseconds in one minute. */
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;

/** Number of seconds in a day, used for session config. */
export const SECONDS_PER_DAY = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

// ─── Backend limits & policy ────────────────────────────────────────────────

/** bcrypt cost factor (security policy: 12 minimum). */
export const BCRYPT_ROUNDS = 12;

/** Session lifetime in days (Auth.js JWT). */
export const SESSION_MAX_AGE_DAYS = 30;

/** Default page size for paginated list endpoints. */
export const DEFAULT_PAGE_SIZE = 25;

/** Maximum page size a client can request. */
export const MAX_PAGE_SIZE = 100;

/** Max length for free-form text fields (titles, single-line inputs). */
export const MAX_INPUT_LENGTH = 200;

/** Max length for long-form text fields (descriptions, notes). */
export const MAX_LONG_TEXT_LENGTH = 5_000;

/**
 * Field length limits — must stay in sync with the matching Mongoose
 * schemas in `@store/db`. Centralised here so route validators and
 * client-side hints can reference one source of truth.
 */
export const FIELD_LIMITS = {
	/** Person's full or display name (Customer, Inquiry contact, addressee). */
	personName: 160,
	/** Phone number (raw, with formatting) — matches Customer/Order schemas. */
	phoneNumber: 32,
	/** City name (Customer, address, inquiry). */
	city: 80,
	/** Address area/sector (free-text neighbourhood). */
	addressArea: 120,
	/** Street + house line. */
	addressStreet: 200,
	/** Postal/ZIP code. */
	postalCode: 16,
	/** Address label ("Home", "Office", …). */
	addressLabel: 60,
	/** Address recipient name (delivery card). */
	recipientName: 120,
	/** Single-line free-text fields (search query, summary, topic, slug-ish). */
	shortText: 200,
	/** Medium-length identifier-style strings: titles, setting keys, customer
	 *  display names, conversation handles. */
	mediumText: 160,
	/** CRM-style notes attached to a customer or inquiry. */
	crmNotes: 2_000,
	/** Long message body (inquiry/conversation thread message). */
	messageBody: 4_000,
	/** Operator/admin notes attached to a variant or order step. */
	operatorNote: 500,
	/** Free-text product category, color name (short label-like fields). */
	shortLabel: 60,
	/** Conversation author name shown next to a message. */
	authorName: 120,
	/** Conversation customer handle. */
	customerHandle: 160,
	/** Provider error message preview captured in our error envelope. */
	providerErrorPreview: 240,
	/** Setting description / metadata copy. */
	settingDescription: 600,
	/** Setting group name. */
	settingGroup: 80,
	/** External URL captured in MediaAsset / image fields. RFC 7230 places no
	 *  hard limit; 2048 is the practical browser ceiling and matches our
	 *  MediaAsset Mongoose schema. */
	mediaUrl: 2_048,
	/** Alt-text on a single image — long enough for full accessibility copy. */
	imageAlt: 240,
} as const;

/**
 * Inclusive lower bound on a product's `releaseYear`. Picked low enough to
 * cover vintage stock while still rejecting obvious typos like `19` or `199`.
 */
export const MIN_PRODUCT_RELEASE_YEAR = 1990;
/**
 * Inclusive upper bound on a product's `releaseYear`. Anything past 2100 is
 * certainly a typo or a farcical pre-order.
 */
export const MAX_PRODUCT_RELEASE_YEAR = 2100;

/** Number of trailing fingerprint chars used to display masked phone tails. */
export const PHONE_TAIL_LENGTH = 4;
/** Length of an ISO date prefix (`YYYY-MM-DD`) sliced from a full ISO string. */
export const ISO_DATE_LENGTH = 10;

/**
 * Length of every customer-facing OTP code. Imported by the OTP service
 * (server) and the sign-in form (client) so the contract stays in one place.
 */
export const OTP_CODE_LENGTH = 6;

/**
 * Max JSON body bytes accepted by API handlers (security.md § Input Validation).
 * Set well above the largest legitimate admin payload (a product with full
 * variant grid + galleries) but far below host-platform defaults.
 */
export const MAX_REQUEST_BODY_BYTES = 1_000_000;

/** Login attempts per IP+identifier before throttling kicks in (security.md § Rate Limiting). */
export const LOGIN_RATE_LIMIT_ATTEMPTS = 8;

/** Password reset request attempts per IP+email before throttling kicks in. */
export const PASSWORD_RESET_RATE_LIMIT_ATTEMPTS = 3;

/**
 * Standard 15-minute window used by login + sensitive public POST endpoints
 * (sign-in, OTP issuance, public order placement) — matches the security
 * policy in `security.md § Rate Limiting`.
 */
export const SHORT_BURST_WINDOW_MS = 15 * MS_PER_MINUTE;

/** Window for the login and reset rate limiter (milliseconds). */
export const LOGIN_RATE_LIMIT_WINDOW_MS = SHORT_BURST_WINDOW_MS;

/** Authenticated admin API requests per IP per minute (security.md § Rate Limiting). */
export const API_RATE_LIMIT_REQUESTS = 300;

/** One-minute rate-limit window — used by per-IP read endpoints. */
export const PER_MINUTE_WINDOW_MS = MS_PER_MINUTE;

/** Window for the authenticated API rate limiter (milliseconds). */
export const API_RATE_LIMIT_WINDOW_MS = PER_MINUTE_WINDOW_MS;

/** How long a verified-session lookup stays cached in memory (milliseconds, security.md § Session Enrichment). */
export const SESSION_CACHE_TTL_MS = 30 * MS_PER_SECOND;

/**
 * Decimal radix passed to `Number.parseInt`. Named so callers don't sprinkle
 * unexplained `10`s across the codebase — ESLint flags bare radixes anyway.
 */
export const DECIMAL_RADIX = 10;
