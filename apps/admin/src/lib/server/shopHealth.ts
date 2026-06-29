/**
 * "Shop health" — the server-side check that drives the dashboard's
 * Shop Health card. Designed to be cheap to run (read-only aggregations,
 * no writes) and exhaustive enough that a store owner can land on the
 * dashboard, glance at the card, and know exactly what's stopping the
 * shop from looking polished and operational today.
 *
 * Each check follows the same shape:
 *   - id          — stable string for the React `key`
 *   - title       — human-friendly summary (e.g. "3 products without images")
 *   - description — extra context, max one sentence
 *   - severity    — `error` | `warn` | `info`; the dashboard sorts by this
 *   - href        — admin route that takes the operator to the fix
 *   - count       — when the check is countable, surfaces in the badge
 *
 * Categories covered:
 *   - Catalog hygiene (active products without images, archived featured)
 *   - Inventory (variants out of stock, low-stock variants)
 *   - Storefront config (missing site name, missing storefront URL)
 *   - Payment readiness (no enabled methods)
 *   - Marketing (invalid pixel IDs)
 *
 * Returning an empty array means "all clear" — the card renders a
 * congratulatory state.
 */
import { connectDB, getIntegrationSettings, getStoreSettings, Product } from "@store/db";
import { STORE_SETTING_DEFAULTS, hasBankTransferDetailsConfigured, isOnlineCardCheckoutReady, readOnlinePaymentIntegrationStatus, resolveIntegrationSettings, resolvePublicSiteUrl, resolveWhatsAppCloudConfig, type StoreSettings } from "@store/shared";

import { LOW_STOCK_VARIANT_THRESHOLD } from "@/lib/server/dashboardStats";

export type ShopHealthSeverity = "error" | "warn" | "info";

export interface ShopHealthCheck {
	id: string;
	title: string;
	description?: string;
	severity: ShopHealthSeverity;
	href?: string;
	count?: number;
}

export interface ShopHealthSummary {
	checks: ShopHealthCheck[];
	/** Total checks across all severities — used by the card badge. */
	total: number;
	/** True when there are zero checks — the card renders an "all clear" state. */
	allClear: boolean;
	/** Highest severity present, drives the card's tone. */
	worstSeverity: ShopHealthSeverity | null;
}

const META_PIXEL_PATTERN = /^\d{6,20}$/;
const GA4_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const GTM_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const TIKTOK_PATTERN = /^[A-Z0-9]{16,40}$/;

function isInvalidPixel(value: string, pattern: RegExp): boolean {
	const trimmed = value.trim();
	if (trimmed.length === 0) return false; // empty = disabled, not invalid
	return !pattern.test(trimmed);
}

interface ProductHealthAgg {
	_id: null;
	productsWithoutImages: number;
	productsWithoutVariants: number;
	productsArchivedButFeatured: number;
	variantsOutOfStock: number;
	variantsLowStock: number;
	activeProductsTotal: number;
}

/** Pull `{ n: count }` out of a `$facet` count pipeline output. */
function facetCountExpr(facetName: string) {
	return {
		$let: {
			vars: { row: { $arrayElemAt: [`$${facetName}`, 0] } },
			in: { $ifNull: ["$$row.n", 0] },
		},
	};
}

function facetVariantsOutOfStockExpr() {
	return {
		$let: {
			vars: { row: { $arrayElemAt: ["$stockBuckets", 0] } },
			in: { $ifNull: ["$$row.variantsOutOfStock", 0] },
		},
	};
}

function facetVariantsLowStockExpr() {
	return {
		$let: {
			vars: { row: { $arrayElemAt: ["$stockBuckets", 0] } },
			in: { $ifNull: ["$$row.variantsLowStock", 0] },
		},
	};
}

async function loadProductHealth(lowStockThreshold: number): Promise<ProductHealthAgg | null> {
	const rows = await Product.aggregate<ProductHealthAgg>([
		{
			$facet: {
				// Active catalog — used as the denominator for "X out of Y".
				activeProductsTotal: [{ $match: { isActive: true, isArchived: { $ne: true } } }, { $count: "n" }],
				// Active products with no photos → can't be displayed properly
				// on the storefront.
				productsWithoutImages: [
					{
						$match: {
							isActive: true,
							isArchived: { $ne: true },
							$or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
						},
					},
					{ $count: "n" },
				],
				// Active products with no variants at all — listing exists but
				// there's nothing to buy.
				productsWithoutVariants: [
					{ $match: { isActive: true, isArchived: { $ne: true } } },
					{
						$project: {
							variantCount: { $size: { $ifNull: ["$variants", []] } },
						},
					},
					{ $match: { variantCount: 0 } },
					{ $count: "n" },
				],
				// Featured but archived — surfaces on home but can't be opened.
				productsArchivedButFeatured: [{ $match: { isFeatured: true, isArchived: true } }, { $count: "n" }],
				// Variant-level stock counts. Source of truth is `variants.quantity`
				// — see `apps/web/src/lib/productSummary.ts`. Out-of-stock = quantity
				// ≤ 0; low-stock = 0 < quantity ≤ threshold.
				stockBuckets: [
					{ $match: { isActive: true, isArchived: { $ne: true } } },
					{ $unwind: "$variants" },
					{
						$group: {
							_id: null,
							variantsOutOfStock: {
								$sum: {
									$cond: [{ $lte: [{ $ifNull: ["$variants.quantity", 0] }, 0] }, 1, 0],
								},
							},
							variantsLowStock: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $gt: [{ $ifNull: ["$variants.quantity", 0] }, 0] },
												{
													$lte: [{ $ifNull: ["$variants.quantity", 0] }, lowStockThreshold],
												},
											],
										},
										1,
										0,
									],
								},
							},
						},
					},
				],
			},
		},
		{
			$project: {
				_id: { $literal: null },
				activeProductsTotal: facetCountExpr("activeProductsTotal"),
				productsWithoutImages: facetCountExpr("productsWithoutImages"),
				productsWithoutVariants: facetCountExpr("productsWithoutVariants"),
				productsArchivedButFeatured: facetCountExpr("productsArchivedButFeatured"),
				variantsOutOfStock: facetVariantsOutOfStockExpr(),
				variantsLowStock: facetVariantsLowStockExpr(),
			},
		},
	]);
	return rows[0] ?? null;
}

function pluralise(count: number, singular: string, plural?: string): string {
	return count === 1 ? singular : (plural ?? `${singular}s`);
}

function evaluateSettings(settings: StoreSettings, cardCheckoutReady: boolean): ShopHealthCheck[] {
	const checks: ShopHealthCheck[] = [];
	const fallbackName = STORE_SETTING_DEFAULTS.siteName;

	if (!settings.siteName.trim() || settings.siteName === fallbackName) {
		checks.push({
			id: "settings-site-name",
			title: "Set your site name",
			description: "Right now the storefront still uses the default name.",
			severity: "warn",
			href: "/settings?tab=store",
		});
	}

	if (!resolvePublicSiteUrl(settings.publicSiteUrl).trim()) {
		checks.push({
			id: "settings-storefront-url",
			title: "Set your storefront URL",
			description: "SEO, canonical links, and admin “View storefront” need a public site address.",
			severity: "warn",
			href: "/settings?tab=urls",
		});
	}

	if (!settings.supportPhone.trim() && !settings.whatsappNumber.trim()) {
		checks.push({
			id: "settings-no-contact",
			title: "Add a support phone or WhatsApp",
			description: "Customers can't reach you from the footer or product pages.",
			severity: "error",
			href: "/settings?tab=contact",
		});
	}

	// Payment readiness — at least one method enabled.
	const enabledMethods = [settings.paymentBankTransferEnabled, settings.paymentCardEnabled, settings.paymentCodEnabled].filter(Boolean).length;
	if (enabledMethods === 0) {
		checks.push({
			id: "payments-none-enabled",
			title: "No payment methods are enabled",
			description: "Customers can't complete checkout right now.",
			severity: "error",
			href: "/settings?tab=payments",
		});
	}
	if (
		settings.paymentBankTransferEnabled &&
		!hasBankTransferDetailsConfigured(settings)
	) {
		checks.push({
			id: "payments-bank-details-missing",
			title: "Bank transfer is on but account details are empty",
			description: "Add bank name and account number under Payments so customers know where to pay.",
			severity: "warn",
			href: "/settings?tab=payments",
		});
	}

	if (settings.paymentCardEnabled && !cardCheckoutReady) {
		checks.push({
			id: "payments-card-gateway-off",
			title: "Pay online is on but no gateway is ready",
			description: "Card won't appear at checkout until PayFast or Rapid Gateway is configured under Integrations — or turn pay online off under Payments.",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}

	// Marketing pixels — only flag invalid IDs (empty is fine, that's "off").
	if (isInvalidPixel(settings.metaPixelId, META_PIXEL_PATTERN)) {
		checks.push({
			id: "marketing-meta-invalid",
			title: "Meta Pixel ID format is invalid",
			description: "The pixel won't load on the storefront until it's a valid ID.",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}
	if (isInvalidPixel(settings.googleAnalyticsId, GA4_PATTERN)) {
		checks.push({
			id: "marketing-ga4-invalid",
			title: "Google Analytics ID format is invalid",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}
	if (isInvalidPixel(settings.googleTagManagerId, GTM_PATTERN)) {
		checks.push({
			id: "marketing-gtm-invalid",
			title: "Google Tag Manager ID format is invalid",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}
	if (isInvalidPixel(settings.tiktokPixelId, TIKTOK_PATTERN)) {
		checks.push({
			id: "marketing-tiktok-invalid",
			title: "TikTok Pixel ID format is invalid",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}

	return checks;
}

function evaluateIntegrations(
	settings: StoreSettings,
	integration: Awaited<ReturnType<typeof getIntegrationSettings>>,
): ShopHealthCheck[] {
	const checks: ShopHealthCheck[] = [];
	const resolved = resolveIntegrationSettings(integration);

	if (!resolved.resendApiKey.trim() || !resolved.resendFromEmail.trim()) {
		checks.push({
			id: "notify-resend-missing",
			title: "Staff email alerts are not configured",
			description: "Add Resend API key and from-address under Integrations so orders and chats email every team member.",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}

	if (!resolved.adminSiteUrl.trim()) {
		checks.push({
			id: "notify-admin-url-missing",
			title: "Admin site URL is missing",
			description: "Alert emails need your admin panel URL so staff can open orders and chats in one tap.",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	}

	const whatsappReady = Boolean(resolveWhatsAppCloudConfig(resolved));
	if (!whatsappReady) {
		checks.push({
			id: "notify-whatsapp-cloud-missing",
			title: "WhatsApp Cloud API is not configured",
			description: "Customers won't get order updates on WhatsApp and staff won't get WhatsApp alerts until Cloud API credentials are set.",
			severity: "warn",
			href: "/settings?tab=integrations",
		});
	} else {
		if (!resolved.whatsappStaffNotifyTemplate.trim()) {
			checks.push({
				id: "notify-staff-whatsapp-template-missing",
				title: "Staff WhatsApp template is missing",
				description: "Set the staff utility template under Integrations for order and chat alerts on WhatsApp.",
				severity: "warn",
				href: "/settings?tab=integrations",
			});
		}
		if (!resolved.whatsappCustomerOrderTemplate.trim()) {
			checks.push({
				id: "notify-customer-order-template-missing",
				title: "Customer order WhatsApp template is missing",
				description: "Set the customer utility template so shoppers get order placed, status, and agent reply updates.",
				severity: "warn",
				href: "/settings?tab=integrations",
			});
		}
	}

	if (settings.paymentCardEnabled) {
		const paymentStatus = readOnlinePaymentIntegrationStatus(integration);
		if (paymentStatus.provider === "rapid-gateway" && paymentStatus.ready && !paymentStatus.webhookConfigured) {
			checks.push({
				id: "payments-rapid-webhook-missing",
				title: "Rapid Gateway webhook secret is missing",
				description: "Paid card orders won't auto-confirm until the webhook secret is saved under Integrations.",
				severity: "warn",
				href: "/settings?tab=integrations",
			});
		}
	}

	return checks;
}

function evaluateProducts(agg: ProductHealthAgg | null, lowStockThreshold: number): ShopHealthCheck[] {
	const checks: ShopHealthCheck[] = [];
	if (!agg) return checks;

	if (agg.activeProductsTotal === 0) {
		checks.push({
			id: "catalog-empty",
			title: "No active products yet",
			description: "Add at least one product so the storefront has something to show.",
			severity: "error",
			href: "/products",
		});
		// No further per-product checks make sense if the catalog is empty.
		return checks;
	}

	if (agg.productsWithoutImages > 0) {
		checks.push({
			id: "catalog-no-images",
			title: `${agg.productsWithoutImages} ${pluralise(agg.productsWithoutImages, "product")} without images`,
			description: "These will show a placeholder on the storefront.",
			severity: "warn",
			href: "/products",
			count: agg.productsWithoutImages,
		});
	}

	if (agg.productsWithoutVariants > 0) {
		checks.push({
			id: "catalog-no-variants",
			title: `${agg.productsWithoutVariants} ${pluralise(agg.productsWithoutVariants, "product")} with no buyable variants`,
			description: "Listings exist but customers have nothing to add to cart.",
			severity: "warn",
			href: "/products",
			count: agg.productsWithoutVariants,
		});
	}

	if (agg.productsArchivedButFeatured > 0) {
		checks.push({
			id: "catalog-featured-archived",
			title: `${agg.productsArchivedButFeatured} archived ${pluralise(agg.productsArchivedButFeatured, "product")} still marked as featured`,
			description: "These won't open from the homepage hero — toggle Featured off or unarchive.",
			severity: "info",
			href: "/products",
			count: agg.productsArchivedButFeatured,
		});
	}

	if (agg.variantsOutOfStock > 0) {
		checks.push({
			id: "stock-out-of-stock",
			title: `${agg.variantsOutOfStock} ${pluralise(agg.variantsOutOfStock, "variant")} out of stock`,
			description: "Customers see 'Out of stock' badges on these.",
			severity: "info",
			href: "/products",
			count: agg.variantsOutOfStock,
		});
	}

	if (agg.variantsLowStock > 0) {
		checks.push({
			id: "stock-low-stock",
			title: `${agg.variantsLowStock} ${pluralise(agg.variantsLowStock, "variant")} low on stock`,
			description: `Stock at or below ${lowStockThreshold} ${pluralise(lowStockThreshold, "unit")}.`,
			severity: "info",
			href: "/products",
			count: agg.variantsLowStock,
		});
	}

	return checks;
}

const SEVERITY_RANK: Record<ShopHealthSeverity, number> = {
	error: 0,
	warn: 1,
	info: 2,
};

export async function loadShopHealth(): Promise<ShopHealthSummary> {
	await connectDB();
	// Best-effort settings load — never let a settings hiccup take down
	// the dashboard. We swap in defaults so the catalog checks still run.
	const settings = await getStoreSettings().catch(() => null);
	const integration = await getIntegrationSettings().catch(() => null);
	const cardCheckoutReady = integration ? isOnlineCardCheckoutReady(integration) : false;
	const lowStockThreshold = settings?.lowStockThreshold ?? LOW_STOCK_VARIANT_THRESHOLD;
	const productAgg = await loadProductHealth(lowStockThreshold).catch(() => null);

	const settingsChecks = settings ? evaluateSettings(settings, cardCheckoutReady) : [];
	const integrationChecks = settings && integration ? evaluateIntegrations(settings, integration) : [];
	const productChecks = evaluateProducts(productAgg, lowStockThreshold);

	const checks = [...settingsChecks, ...integrationChecks, ...productChecks].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

	return {
		checks,
		total: checks.length,
		allClear: checks.length === 0,
		worstSeverity: checks[0]?.severity ?? null,
	};
}
