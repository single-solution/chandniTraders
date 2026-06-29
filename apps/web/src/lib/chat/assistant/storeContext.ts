import { formatPrice, type AssistantStoreContext, type Product } from "@store/shared";

import { productHref } from "@/lib/catalog/productPaths";
import { formatAssistantActiveDeals } from "@/lib/chat/assistant/offerQuote";
import { isProductInStock } from "@/lib/productSummary";
import { getAccountChatProfile, getAccountOrders } from "@/lib/core/account";
import { getProductById } from "@/lib/core/queries";
import type { Order } from "@/lib/core/orderSerializer";
import { getActiveOffersCached, getCategoriesCached, getProductsPageCached, getStoreSettingsCached } from "@/lib/core/cached";

/**
 * Always-injected catalog snapshot (newest first). Deliberately tiny: it only
 * has to answer "what's new / what do you have" in one shot. Everything
 * specific (a model, a budget, a category) goes through the `search_catalog`
 * tool, so keeping this short cuts prompt tokens on every message AND on every
 * tool round (the system prompt is resent each round).
 */
const CATALOG_CONTEXT_LIMIT = 10;

/** How many of the customer's orders to load; full detail on the most recent few. */
const ORDER_CONTEXT_LIMIT = 15;
const ORDER_CONTEXT_DETAILED = 5;

function formatOrderDate(iso?: string): string {
	if (!iso) {
		return "";
	}
	return iso.slice(0, 10);
}

function formatOrderLine(order: Order, detailed: boolean): string {
	const parts = [`#${order.orderNumber}`, formatOrderDate(order.placedAt), order.statusLabel, `total ${formatPrice(order.totals.totalRupees)}`];
	if (detailed) {
		const items = order.items
			.map((item) => {
				const variant = item.variantSummary ? ` (${item.variantSummary})` : "";
				return `${item.quantity}× ${item.productName}${variant}`;
			})
			.join(", ");
		if (items) {
			parts.push(`items: ${items}`);
		}
		if (order.estimatedDeliveryAt) {
			parts.push(`est. delivery ${formatOrderDate(order.estimatedDeliveryAt)}`);
		}
		if (order.trackingNote?.trim()) {
			parts.push(`note: ${order.trackingNote.trim()}`);
		}
		if (order.dispatchVideoUrl?.trim()) {
			parts.push("dispatch video ready (view on their order page in account)");
		}
	}
	return `- ${parts.filter(Boolean).join(" | ")}`;
}

export async function buildOrderContext(verifiedCustomerId?: string): Promise<string | undefined> {
	if (!verifiedCustomerId) {
		return undefined;
	}
	const orders = await getAccountOrders(verifiedCustomerId, ORDER_CONTEXT_LIMIT);
	if (orders.length === 0) {
		return "This customer is signed in but has no orders yet.";
	}
	return orders.map((order, index) => formatOrderLine(order, index < ORDER_CONTEXT_DETAILED)).join("\n");
}

/**
 * Tiny signed-in profile injected on every message: just enough to greet by
 * name and nudge loyalty. Orders, addresses, and points history stay behind the
 * `get_my_orders` / `get_my_account` tools so we don't pay those tokens unless
 * the customer actually asks. Returns `undefined` for guests.
 */
async function buildCustomerProfileLine(verifiedCustomerId?: string): Promise<string | undefined> {
	if (!verifiedCustomerId) {
		return undefined;
	}
	const profile = await getAccountChatProfile(verifiedCustomerId);
	if (!profile) {
		return undefined;
	}
	const firstName = profile.name?.trim().split(/\s+/)[0] ?? "";
	const parts = [firstName ? `name ${firstName}` : "", profile.city ? `city ${profile.city}` : ""];
	if (profile.loyaltyBalance !== null) {
		parts.push(`loyalty ${profile.loyaltyBalance} pts`);
	}
	return parts.filter(Boolean).join(" · ") || undefined;
}

export function formatCatalogLine(product: Product): string {
	const inStock = isProductInStock(product);
	const path = productHref(product);

	// Cheapest in-stock/list price so the assistant can quote a concrete rate.
	let lowestPrice: number | undefined;
	for (const variant of product.variants) {
		if (variant.priceRupees <= 0) {
			continue;
		}
		if (lowestPrice === undefined || variant.priceRupees < lowestPrice) {
			lowestPrice = variant.priceRupees;
		}
	}

	const priceText = lowestPrice !== undefined ? `from ${formatPrice(lowestPrice)}` : "price on request";

	return [`- ${product.brandName} ${product.name}`, priceText, inStock ? "in stock" : "out of stock", `link: ${path}`].filter(Boolean).join(" | ");
}

export { formatAssistantActiveDeals as formatDeals } from "@/lib/chat/assistant/offerQuote";

async function loadSubjectProduct(subjectProductId?: string): Promise<Product | null> {
	if (!subjectProductId) {
		return null;
	}
	return getProductById(subjectProductId);
}

export async function buildAssistantStoreContext(input: {
	customerMessage: string;
	subjectProductId?: string;
	subjectProductName?: string;
	/** Session-verified customer id — never derived from anything the customer typed. */
	verifiedCustomerId?: string;
}): Promise<AssistantStoreContext> {
	// Broad live catalog snapshot — chat sentences rarely match product names verbatim.
	const [settings, categories, catalogPage, offers, subjectProduct, customerProfile] = await Promise.all([
		getStoreSettingsCached(),
		getCategoriesCached(),
		getProductsPageCached({
			limit: CATALOG_CONTEXT_LIMIT,
			sort: "newest",
		}),
		getActiveOffersCached(),
		loadSubjectProduct(input.subjectProductId),
		buildCustomerProfileLine(input.verifiedCustomerId),
	]);

	const activeCategories = categories
		.filter((category) => category.isActive)
		.map((category) => category.label)
		.join(", ");

	const catalogLines = new Map<string, string>();
	if (subjectProduct) {
		catalogLines.set(subjectProduct.id, formatCatalogLine(subjectProduct));
	}
	for (const product of catalogPage.products) {
		if (!catalogLines.has(product.id)) {
			catalogLines.set(product.id, formatCatalogLine(product));
		}
	}

	const paymentMethods = [
		settings.paymentBankTransferEnabled ? "bank transfer (screenshot on WhatsApp)" : "",
		settings.paymentCodEnabled ? "cash on delivery" : "",
		settings.paymentCardEnabled ? "card payment" : "",
	].filter(Boolean);

	const policies = [
		`Warranty: ${settings.defaultWarrantyMonths} months on eligible items.`,
		`Money-back window: ${settings.moneybackDays} days (store policy).`,
		`Free delivery above ${formatPrice(settings.freeDeliveryThresholdRupees)}.`,
		settings.codSurchargePercent > 0 ? `Cash on delivery handling: +${settings.codSurchargePercent}% on merchandise subtotal.` : "",
		`Loyalty: earn ${settings.loyaltyEarnPercent}% back on orders.`,
		settings.globalDeliveryNote?.trim() ? `Delivery: ${settings.globalDeliveryNote.trim()}.` : "",
		paymentMethods.length > 0 ? `Payment methods at checkout: ${paymentMethods.join(", ")}.` : "",
		settings.paymentCodEnabled && settings.paymentCodNote?.trim() ? `COD: ${settings.paymentCodNote.trim()}.` : "",
	]
		.filter(Boolean)
		.join(" ");

	let subjectProductBlock: string | undefined;
	if (subjectProduct) {
		subjectProductBlock = formatCatalogLine(subjectProduct);
	} else if (input.subjectProductName) {
		subjectProductBlock = `Customer opened chat about "${input.subjectProductName}" (unverified snapshot — confirm live stock on site).`;
	}

	return {
		siteName: settings.siteName,
		siteTagline: settings.siteTagline,
		supportPhone: settings.supportPhone,
		supportEmail: settings.supportEmail,
		whatsapp: settings.whatsappNumber,
		storeAddress: `${settings.storeAddressLine1}, ${settings.storeAddressLine2}`.trim(),
		storeHours: settings.storeHours,
		policies,
		categories: activeCategories || "See /",
		catalog: catalogLines.size > 0 ? [...catalogLines.values()].join("\n") : "No matching products in catalog for this query — do not invent models or prices.",
		deals: formatAssistantActiveDeals(offers),
		subjectProduct: subjectProductBlock,
		account: customerProfile,
		isSignedIn: Boolean(input.verifiedCustomerId),
	};
}
