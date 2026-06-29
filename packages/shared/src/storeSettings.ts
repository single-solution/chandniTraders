/**
 * Runtime store settings — the values an admin can change without a deploy.
 *
 * Two layers cooperate:
 *   1. `STORE_SETTING_DEFAULTS` here — the factory defaults baked into the
 *      bundle. They guarantee the storefront always has a sane value, even
 *      before the admin has saved anything or if Mongo is unreachable.
 *   2. The `Setting` collection in MongoDB — the admin's overrides. Every
 *      key managed here is stored with the `store.` prefix so it can't
 *      collide with future ad-hoc settings (e.g. `feature.<name>`).
 *
 * Consumers MUST go through `getStoreSettings()` (in `@store/db`) on the
 * server, or receive the values as props from a server component. Never
 * import `STORE_SETTING_DEFAULTS` directly from a UI component — that
 * defeats the whole point of admin manageability.
 */

export interface StoreSettings {
	/** Storefront brand name shown in the header, footer, page titles, and AI assistant greeting. */
	siteName: string;
	/** One-line storefront tagline used in the homepage hero / OG metadata. */
	siteTagline: string;
	/**
	 * Public storefront origin (e.g. `https://chandnitraders.pk`). Used by the
	 * admin's "View storefront" links and as the canonical base for SEO tags.
	 * Empty string falls back to the `*_SITE_URL` / `STOREFRONT_BASE_URL` env
	 * vars so existing deploys keep working without an admin save.
	 */
	publicSiteUrl: string;

	/**
	 * Brand mark URLs used by the storefront chrome. Each pair has a light
	 * variant (sits on light surfaces — top header, login screen) and a
	 * dark variant (sits on the dark footer, dark system favicons).
	 *
	 * Empty string = no upload → the chrome falls back to the wordmark
	 * (`siteName`) only, no badge/icon. Browsers fall back to whichever
	 * favicon variant is present, or to `/favicon.ico` when both are empty.
	 */
	brandLogoLight: string;
	brandLogoDark: string;
	brandFaviconLight: string;
	brandFaviconDark: string;

	/** Injected at request time — not stored in Mongo. Hides pay-online when no PK gateway is configured. */
	cardCheckoutReady?: boolean;

	/** Mobile/cell number callers reach for sales + support (phone calls only — not WhatsApp chat links). */
	supportPhone: string;
	/** Landline number printed in the footer. */
	supportLandline: string;
	/** Public support email shown on the storefront and used in transactional copy. */
	supportEmail: string;
	/** Customer-facing WhatsApp for storefront chat links (footer, PDP, orders). Not support phone or staff alert numbers. */
	whatsappNumber: string;

	/** First line of the physical store address (street/area). */
	storeAddressLine1: string;
	/** Second line of the physical store address (city/country). */
	storeAddressLine2: string;
	/** Human-readable opening hours, e.g. `Mon–Sat · 11 AM – 9 PM`. */
	storeHours: string;

	socialFacebook: string;
	socialInstagram: string;
	socialTiktok: string;
	socialYoutube: string;
	socialGoogleMaps: string;

	/** Order subtotal in rupees above which delivery is free. */
	freeDeliveryThresholdRupees: number;
	/** Flat courier fee when delivery is not free. */
	courierFlatFeeRupees: number;
	/** Default warranty period (in months) shown on product pages. */
	defaultWarrantyMonths: number;
	/** Number of days the moneyback window stays open. */
	moneybackDays: number;
	/** Return & refund policy shown in checkout and policy modals (sanitized HTML). */
	returnPolicyHtml: string;
	/** Privacy policy shown in checkout and policy modals (sanitized HTML). */
	privacyPolicyHtml: string;
	/** % of order total returned as loyalty points (e.g. 1 → 1% back). */
	loyaltyEarnPercent: number;

	// ── Payment method availability ─────────────────────────────────────────
	/** Show bank transfer at checkout (lowest cost — manual confirmation). */
	paymentBankTransferEnabled: boolean;
	/** Show pay-online at checkout (requires PayFast or Rapid Gateway under Integrations). */
	paymentCardEnabled: boolean;
	/** Show cash on delivery at checkout. */
	paymentCodEnabled: boolean;
	/** Extra % added to subtotal when the customer picks cash on delivery. */
	codSurchargePercent: number;

	// ── Bank transfer details (shown at checkout + order pages) ─────────────
	bankName: string;
	bankAccountTitle: string;
	bankAccountNumber: string;
	bankIban: string;

	// ── Checkout copy ───────────────────────────────────────────────────────
	/** Short note under the bank transfer chip. */
	paymentBankTransferNote: string;
	/** Short note under the card payment chip. */
	paymentCardNote: string;
	/** Short note under the cash on delivery chip. */
	paymentCodNote: string;

	// ── Global Notices ────────────────────────────────────────────────────────
	/** Global delivery note shown on PDPs and checkout (e.g., "3 to 5 working days"). */
	globalDeliveryNote: string;
	/** Text for the global store notice banner. */
	storeNoticeText: string;
	/** Whether the global store notice banner is enabled. */
	storeNoticeEnabled: boolean;

	// ── Inventory ───────────────────────────────────────────────────────────
	/**
	 * Low-stock alert threshold — variant stock counts at or below this trigger
	 * the dashboard low-stock KPI and the bell-menu "low stock" alert. Stored
	 * as a number rather than a constant so a busy weekend can ratchet it up.
	 */
	lowStockThreshold: number;

	// ── Marketing pixels (empty = disabled) ─────────────────────────────────
	/** Meta (Facebook) Pixel ID — bare numeric ID, e.g. `123456789012345`. */
	metaPixelId: string;
	/** GA4 measurement ID, e.g. `G-XXXXXXXXXX`. */
	googleAnalyticsId: string;
	/** Google Tag Manager container ID, e.g. `GTM-XXXXXXX`. */
	googleTagManagerId: string;
	/** TikTok Pixel ID, e.g. `CXXXXXXXXXXXXXXXXX`. */
	tiktokPixelId: string;
}

export function hasBankTransferDetailsConfigured(settings: Pick<StoreSettings, "bankAccountNumber" | "bankIban">): boolean {
	return Boolean(settings.bankAccountNumber.trim() || settings.bankIban.trim());
}

export const STORE_SETTING_DEFAULTS: StoreSettings = {
	siteName: "Chandni Traders",
	siteTagline: "All kind of fans at wholesale prices",
	publicSiteUrl: "https://chandnitraders.pk",

	brandLogoLight: "",
	brandLogoDark: "",
	brandFaviconLight: "",
	brandFaviconDark: "",

	supportPhone: "03074451762",
	supportLandline: "04237233033",
	supportEmail: "chandnitraders502@gmail.com",
	whatsappNumber: "923111105846",

	storeAddressLine1: "H87C+257, Beadon Road, Garhi Shahu",
	storeAddressLine2: "Lahore, Punjab",
	storeHours: "Mon–Sat 9am–9pm · Sun 9am–5pm",

	socialFacebook: "",
	socialInstagram: "",
	socialTiktok: "",
	socialYoutube: "",
	socialGoogleMaps: "",

	freeDeliveryThresholdRupees: 10_000,
	courierFlatFeeRupees: 1_500,
	defaultWarrantyMonths: 6,
	moneybackDays: 7,
	returnPolicyHtml: `<h2>Return &amp; moneyback</h2><p>You may request a full refund within <strong>7 days</strong> of delivery if the item is unused and in the same condition you received it.</p><ul><li>Contact us on WhatsApp with your order number.</li><li>We arrange pickup or in-store drop-off.</li><li>Refunds are processed to your original payment method once the return is verified.</li></ul>`,
	privacyPolicyHtml: `<h2>Privacy</h2><p>We collect your name, phone number, and delivery address to fulfil orders and send updates on WhatsApp.</p><p>We do not sell your data. Order history is kept for warranty and support. You may ask us to delete your account data by contacting support.</p>`,
	loyaltyEarnPercent: 1,

	paymentBankTransferEnabled: true,
	paymentCardEnabled: false,
	paymentCodEnabled: true,
	codSurchargePercent: 0,

	bankName: "",
	bankAccountTitle: "",
	bankAccountNumber: "",
	bankIban: "",

	paymentBankTransferNote: "",
	paymentCardNote: "",
	paymentCodNote: "",

	globalDeliveryNote: "3 to 5 working days",
	storeNoticeText: "",
	storeNoticeEnabled: false,

	lowStockThreshold: 2,

	metaPixelId: "",
	googleAnalyticsId: "",
	googleTagManagerId: "",
	tiktokPixelId: "",
};

/** Prefix used on every `Setting.key` that backs a `StoreSettings` field. */
export const STORE_SETTING_KEY_PREFIX = "store.";

/** Stable list of every managed key, derived from the defaults to stay in sync. */
export const STORE_SETTING_KEYS = Object.keys(STORE_SETTING_DEFAULTS) as Array<keyof StoreSettings>;

/**
 * Maps a `StoreSettings` field to the Mongo `Setting.group` it belongs to.
 * Used by the admin UI for tabbed editing and by the API for filtering.
 */
export const STORE_SETTING_GROUPS = {
	urls: ["publicSiteUrl"] as const,
	branding: ["siteName", "siteTagline", "brandLogoLight", "brandLogoDark", "brandFaviconLight", "brandFaviconDark"] as const,
	contact: ["supportPhone", "supportLandline", "supportEmail", "whatsappNumber"] as const,
	address: ["storeAddressLine1", "storeAddressLine2", "storeHours"] as const,
	notices: ["globalDeliveryNote", "storeNoticeText", "storeNoticeEnabled"] as const,
	social: ["socialFacebook", "socialInstagram", "socialTiktok", "socialYoutube", "socialGoogleMaps"] as const,
	policy: ["defaultWarrantyMonths", "moneybackDays", "returnPolicyHtml", "privacyPolicyHtml"] as const,
	delivery: ["freeDeliveryThresholdRupees", "courierFlatFeeRupees"] as const,
	loyalty: ["loyaltyEarnPercent"] as const,
	payments: [
		"paymentBankTransferEnabled",
		"paymentCardEnabled",
		"paymentCodEnabled",
		"codSurchargePercent",
		"bankName",
		"bankAccountTitle",
		"bankAccountNumber",
		"bankIban",
		"paymentBankTransferNote",
		"paymentCardNote",
		"paymentCodNote",
	] as const,
	inventory: ["lowStockThreshold"] as const,
	marketing: ["metaPixelId", "googleAnalyticsId", "googleTagManagerId", "tiktokPixelId"] as const,
} satisfies Record<string, ReadonlyArray<keyof StoreSettings>>;

type StoreSettingGroup = keyof typeof STORE_SETTING_GROUPS;

/** Convert `siteName` → `store.siteName` (the actual Mongo key). */
export function toStoreSettingKey(field: keyof StoreSettings): string {
	return `${STORE_SETTING_KEY_PREFIX}${field}`;
}

/** Reverse of `toStoreSettingKey`; returns `null` for unrelated keys. */
export function fromStoreSettingKey(key: string): keyof StoreSettings | null {
	if (!key.startsWith(STORE_SETTING_KEY_PREFIX)) {
		return null;
	}
	const stripped = key.slice(STORE_SETTING_KEY_PREFIX.length);
	return stripped in STORE_SETTING_DEFAULTS ? (stripped as keyof StoreSettings) : null;
}

/** Find which group a managed field belongs to (used by serializers). */
export function groupForField(field: keyof StoreSettings): StoreSettingGroup {
	for (const [group, fields] of Object.entries(STORE_SETTING_GROUPS) as Array<[StoreSettingGroup, ReadonlyArray<keyof StoreSettings>]>) {
		if (fields.includes(field)) {
			return group;
		}
	}
	// Defensive — every key in STORE_SETTING_DEFAULTS is also in STORE_SETTING_GROUPS,
	// so this branch is unreachable unless the two lists drift apart.
	throw new Error(`Field "${field}" is not assigned to a settings group.`);
}

/**
 * Coerces a raw value coming back from Mongo into the typed value expected by
 * `StoreSettings`. Returns `null` if the value can't be safely coerced — the
 * caller should then fall back to the default.
 */
export function coerceStoreSettingValue<K extends keyof StoreSettings>(field: K, raw: unknown): StoreSettings[K] | null {
	const expected = typeof STORE_SETTING_DEFAULTS[field];
	if (expected === "number") {
		if (typeof raw === "number" && Number.isFinite(raw)) {
			return raw as StoreSettings[K];
		}
		if (typeof raw === "string") {
			const parsed = Number(raw);
			if (Number.isFinite(parsed)) {
				return parsed as StoreSettings[K];
			}
		}
		return null;
	}
	if (expected === "string") {
		if (typeof raw === "string") {
			return raw as StoreSettings[K];
		}
		return null;
	}
	if (expected === "boolean") {
		if (typeof raw === "boolean") {
			return raw as StoreSettings[K];
		}
		// Mongo can hand back stringified booleans from older docs and the admin
		// form sends real booleans, so coerce both rather than refusing the save.
		if (raw === "true") return true as StoreSettings[K];
		if (raw === "false") return false as StoreSettings[K];
		return null;
	}
	return null;
}
