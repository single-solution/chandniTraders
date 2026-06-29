/**
 * Customer-safe offer quoting for the chat assistant.
 * Uses the same evaluator as checkout — never exposes admin-only fields
 * (usage counts, internal ids, raw condition trees, stack rules).
 */

import {
	evaluateCartOffers,
	formatActiveDealsMarkdownTable,
	formatOfferDiscountLabel,
	formatPrice,
	getPaymentMethodLabel,
	isVariantInStock,
	resolveOfferMinQuantity,
	slugify,
	type ActiveOffer,
	type OfferCondition,
	type OfferPaymentMethod,
	type Product,
	type StoreSettings,
} from "@store/shared";

import { productHref } from "@/lib/catalog/productPaths";
import { buildEvaluatableItemWithQuantity } from "@/lib/pricing/cartOfferPricing";
import { resolveVariantCatalogDealOffers } from "@/lib/pricing/productOfferMatch";
import { getActiveOffersCached, getProductBySlugCached, getStoreSettingsCached, searchAssistantCatalogCached } from "@/lib/core/cached";

const MAX_QUOTE_QUANTITY = 5;
const CHECKOUT_PAYMENT_METHODS: OfferPaymentMethod[] = ["bank-transfer", "card", "cod"];

function describeCartTotalCondition(condition: OfferCondition): string | null {
	if (condition.type !== "cart_total") {
		return null;
	}
	if (condition.operator === "gte") {
		return `cart ${formatPrice(Number(condition.value))} or more`;
	}
	if (condition.operator === "lte") {
		return `cart up to ${formatPrice(Number(condition.value))}`;
	}
	if (condition.operator === "between" && Array.isArray(condition.value) && condition.value.length === 2) {
		const [minimum, maximum] = condition.value as [number, number];
		return `cart ${formatPrice(minimum)}–${formatPrice(maximum)}`;
	}
	return null;
}

function describePaymentMethodCondition(condition: OfferCondition): string | null {
	if (condition.type !== "payment_method") {
		return null;
	}
	const methods = Array.isArray(condition.value) ? condition.value : [condition.value];
	const labels = methods.map((method) => getPaymentMethodLabel(String(method))).filter(Boolean);
	if (labels.length === 0) {
		return null;
	}
	return `pay by ${labels.join(" or ")}`;
}

/** Customer-visible eligibility hints — no raw rules or internal ids. */
export function describeAssistantOfferEligibility(offer: ActiveOffer): string | undefined {
	const hints: string[] = [];
	for (const condition of offer.conditions) {
		const cartHint = describeCartTotalCondition(condition);
		if (cartHint) {
			hints.push(cartHint);
		}
		const paymentHint = describePaymentMethodCondition(condition);
		if (paymentHint) {
			hints.push(paymentHint);
		}
		if (condition.type === "min_quantity" && condition.operator === "gte") {
			const quantity = Number(condition.value);
			if (Number.isFinite(quantity) && quantity > 1) {
				hints.push(`min ${Math.floor(quantity)} units`);
			}
		}
	}
	if (hints.length === 0) {
		return undefined;
	}
	return hints.join(" · ");
}

/** Rich deal list for the assistant — markdown table for chat UI. */
export function formatAssistantActiveDeals(offers: ActiveOffer[]): string | undefined {
	return formatActiveDealsMarkdownTable(offers);
}

async function resolveProductReference(reference: string): Promise<Product | null> {
	const trimmed = reference.trim();
	if (!trimmed) {
		return null;
	}
	const slugGuess = trimmed.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
	let product = slugGuess ? await getProductBySlugCached(slugGuess) : null;
	if (!product) {
		const matches = await searchAssistantCatalogCached({
			search: trimmed.slice(0, 80),
			limit: 1,
		});
		product = matches[0] ?? null;
	}
	return product;
}

function pickInStockVariant(product: Product): Product["variants"][number] | null {
	const inStock = product.variants.filter((variant) => isVariantInStock(variant));
	if (inStock.length === 0) {
		return null;
	}
	return inStock.reduce((cheapest, variant) => (variant.priceRupees < cheapest.priceRupees ? variant : cheapest));
}

function enabledCheckoutPaymentMethods(settings: StoreSettings): OfferPaymentMethod[] {
	return CHECKOUT_PAYMENT_METHODS.filter((method) => {
		if (method === "bank-transfer") {
			return settings.paymentBankTransferEnabled;
		}
		if (method === "card") {
			return settings.paymentCardEnabled;
		}
		return settings.paymentCodEnabled;
	});
}

function formatVariantLabel(product: Product, variant: Product["variants"][number]): string {
	const specs = Object.values(variant.attributeDisplay ?? {})
		.filter(Boolean)
		.join(", ");
	return [product.brandName, product.name, specs].filter(Boolean).join(" | ");
}

function formatAppliedSavings(evaluation: ReturnType<typeof evaluateCartOffers>, listTotal: number): string {
	const parts: string[] = [];
	for (const discounts of evaluation.itemDiscounts.values()) {
		for (const discount of discounts) {
			parts.push(`${discount.offerTitle} (−${formatPrice(Math.round(discount.discountAmount))})`);
		}
	}
	for (const discount of evaluation.cartDiscounts) {
		parts.push(`${discount.offerTitle} (−${formatPrice(Math.round(discount.discountAmount))})`);
	}
	if (evaluation.freeShipping) {
		parts.push("free delivery eligible");
	}
	if (parts.length === 0) {
		return `no extra checkout promos on ${formatPrice(listTotal)}`;
	}
	return parts.join("; ");
}

/**
 * Quote savings for one in-stock variant using checkout logic.
 * Output is limited to what a shopper would see on the PDP / checkout.
 */
export async function quoteProductSavings(input: {
	productReference: string;
	quantity?: number;
	comparePaymentMethods?: boolean;
}): Promise<string> {
	const product = await resolveProductReference(input.productReference);
	if (!product) {
		return `No catalog product matched "${input.productReference.slice(0, 80)}". Do not invent pricing — search the catalog or confirm with the team.`;
	}

	const variant = pickInStockVariant(product);
	if (!variant) {
		return `${product.brandName} ${product.name} is out of stock right now. Do not quote a price — suggest another model or ask the team to check restock.`;
	}

	const quantity = Math.min(Math.max(Math.floor(input.quantity ?? 1), 1), MAX_QUOTE_QUANTITY);
	const [offers, settings] = await Promise.all([getActiveOffersCached(), getStoreSettingsCached()]);
	const catalogOffers = resolveVariantCatalogDealOffers(product, variant, offers);
	const catalogOffer = catalogOffers[0] ?? null;
	const minQuantity = catalogOffer ? resolveOfferMinQuantity(catalogOffer) : 1;
	if (quantity < minQuantity) {
		return `${formatVariantLabel(product, variant)} needs at least ${minQuantity} unit(s) for the "${catalogOffer?.title ?? "deal"}" promo. Ask if they want ${minQuantity} or a different model.`;
	}

	const item = buildEvaluatableItemWithQuantity(product, variant, quantity);
	const listTotal = item.price * item.quantity;
	const lineOfferIds = catalogOffer ? { [item.id]: catalogOffer.id } : undefined;

	const comparePaymentMethods = input.comparePaymentMethods !== false;
	const paymentMethods = enabledCheckoutPaymentMethods(settings);
	if (paymentMethods.length === 0) {
		return "Checkout payment methods are not configured — do not quote a final total; point them to the site or a teammate.";
	}

	const lines: string[] = [
		formatVariantLabel(product, variant),
		`List price: ${formatPrice(item.price)} × ${quantity} = ${formatPrice(listTotal)}`,
	];

	if (catalogOffer) {
		lines.push(`Catalog deal on this variant: ${catalogOffer.title} (${formatOfferDiscountLabel(catalogOffer.action)})`);
		const eligibility = describeAssistantOfferEligibility(catalogOffer);
		if (eligibility) {
			lines.push(`Deal needs: ${eligibility}`);
		}
	} else {
		lines.push("No catalog deal on this exact variant right now.");
	}

	if (comparePaymentMethods) {
		lines.push("Estimated at checkout (same rules as the website):");
		let bestMethod: OfferPaymentMethod | null = null;
		let bestTotal = listTotal;

		for (const paymentMethod of paymentMethods) {
			const evaluation = evaluateCartOffers([item], offers, {
				paymentMethod,
				lineOfferIds,
			});
			const savingsNote = formatAppliedSavings(evaluation, listTotal);
			lines.push(`- ${getPaymentMethodLabel(paymentMethod)}: ${formatPrice(Math.round(evaluation.finalTotal))} (${savingsNote})`);
			if (evaluation.finalTotal < bestTotal) {
				bestTotal = evaluation.finalTotal;
				bestMethod = paymentMethod;
			}
		}

		if (bestMethod && bestTotal < listTotal) {
			lines.push(`Best payment option today: ${getPaymentMethodLabel(bestMethod)} → about ${formatPrice(Math.round(bestTotal))}.`);
		}
	} else {
		const evaluation = evaluateCartOffers([item], offers, { lineOfferIds });
		lines.push(`Estimated total: ${formatPrice(Math.round(evaluation.finalTotal))} (${formatAppliedSavings(evaluation, listTotal)}).`);
	}

	if (settings.codSurchargePercent > 0 && settings.paymentCodEnabled) {
		lines.push(`Note: COD may add ${settings.codSurchargePercent}% handling at checkout — same as the site.`);
	}
	lines.push(`Product link: ${productHref(product)}`);
	lines.push("Customer should add to cart on the site to lock catalog pricing.");

	return lines.join("\n");
}
