import {
	buildDealListMessageChunks,
	customerAskedAboutAccount,
	customerAskedAboutOrders,
	customerAskedAboutPopular,
	extractBudgetMaxRupees,
	extractCatalogSearchQueries,
	formatCatalogProductsMarkdownTable,
	isChatStopWord,
	slugify,
	type ActiveOffer,
	type CustomerMessageLanguage,
	type Product,
} from "@store/shared";

import { getAccountChatProfile } from "@/lib/core/account";
import { cheapestPriceSummary, productToCatalogTableRow } from "@/lib/chat/assistant/catalogProductFormat";
import { buildOrderContext } from "@/lib/chat/assistant/storeContext";
import { getActiveOffersCached, getPopularProductsCached, searchAssistantCatalogCached } from "@/lib/core/cached";
import { getProductById } from "@/lib/core/queries";

const CATALOG_RESULT_LIMIT = 8;

function isUrduLanguage(language: CustomerMessageLanguage): boolean {
	return language === "roman_urdu" || language === "urdu_script";
}

function matchOffersByMessage(offers: ActiveOffer[], message: string): ActiveOffer[] {
	const queries = extractCatalogSearchQueries(message).map((query) => query.toLowerCase());
	if (queries.length === 0) {
		return [];
	}
	return offers.filter((offer) => {
		const title = offer.title?.trim().toLowerCase() ?? "";
		if (!title) {
			return false;
		}
		return queries.some((query) => query.length >= 3 && (title.includes(query) || query.includes(title.split(/\s+/)[0] ?? "")));
	});
}

function messageReferencesSubject(message: string, subjectProductName?: string, product?: Product | null): boolean {
	const trimmed = message.trim();
	if (trimmed.length <= 48) {
		return true;
	}
	const lower = trimmed.toLowerCase();
	if (subjectProductName && lower.includes(subjectProductName.toLowerCase().slice(0, 16))) {
		return true;
	}
	if (product) {
		if (lower.includes(product.name.toLowerCase()) || lower.includes(product.brandName.toLowerCase())) {
			return true;
		}
	}
	return /\b(this|this one|yeh|ye|is product|is fan|is model|same product)\b/i.test(trimmed);
}

async function searchProductsForMessage(queries: string[], maxBudget?: number): Promise<Product[]> {
	const searchQueries = queries.length > 0 ? queries : maxBudget ? [""] : [];
	if (searchQueries.length === 0) {
		return [];
	}

	const ranked = new Map<string, { product: Product; score: number }>();

	await Promise.all(
		searchQueries.map(async (query, queryIndex) => {
			const results = await searchAssistantCatalogCached({
				search: query || undefined,
				maxPriceRupees: maxBudget,
				limit: CATALOG_RESULT_LIMIT,
			});
			for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
				const product = results[resultIndex];
				if (!product?.id) {
					continue;
				}
				const rankBoost = searchQueries.length - resultIndex + (queryIndex === 0 ? 3 : 1);
				const existing = ranked.get(product.id);
				ranked.set(product.id, {
					product,
					score: Math.max(existing?.score ?? 0, rankBoost),
				});
			}
		}),
	);

	return [...ranked.values()]
		.sort((left, right) => right.score - left.score)
		.map((entry) => entry.product)
		.slice(0, CATALOG_RESULT_LIMIT);
}

function buildCatalogListReply(
	products: Product[],
	language: CustomerMessageLanguage,
	kind: "search" | "budget" | "popular",
): string[] {
	const isUrdu = isUrduLanguage(language);
	const rows = products.map(productToCatalogTableRow);
	const table = formatCatalogProductsMarkdownTable(rows);
	if (!table) {
		return [];
	}

	let intro = isUrdu ? "Yeh matches live catalog se:" : "Here are live matches from our catalog:";
	if (kind === "budget") {
		intro = isUrdu ? "Aap ke budget range mein yeh in-stock options hain:" : "In your budget range, these in-stock options stand out:";
	}
	if (kind === "popular") {
		intro = isUrdu ? "Abhi yeh models zyada sell ho rahe hain:" : "These models are selling well right now:";
	}

	const outro = isUrdu
		? "Kisi ek par detail ya payment quote chahiye ho to model ka naam likh dein."
		: "Want detail or a payment quote on any of these? Name the model.";

	return [intro, table, outro];
}

function buildSingleProductReply(
	product: Product,
	language: CustomerMessageLanguage,
	fromSubject: boolean,
): string[] {
	const isUrdu = isUrduLanguage(language);
	const table = formatCatalogProductsMarkdownTable([productToCatalogTableRow(product)]);
	if (!table) {
		return [];
	}

	const intro = isUrdu
		? fromSubject
			? "Is product ke live details:"
			: "Sab se qareeb match:"
		: fromSubject
			? "Live details for the product you opened:"
			: "Closest match I found:";

	const outro = isUrdu
		? `Sab se sasti option abhi **${cheapestPriceSummary(product)}** hai. Storage ya colour specify karein to exact quote de dun ga.`
		: `Best price right now is **${cheapestPriceSummary(product)}**. Tell me storage or colour for an exact quote.`;

	return [intro, table, outro];
}

async function buildOrderFallback(
	verifiedCustomerId: string | undefined,
	language: CustomerMessageLanguage,
): Promise<string[] | null> {
	const isUrdu = isUrduLanguage(language);
	if (!verifiedCustomerId) {
		return isUrdu
			? ["Apne orders dekhne ke liye pehle /account par sign in karein (WhatsApp OTP)."]
			: ["Sign in at /account (WhatsApp OTP) to see your own orders."];
	}

	const orders = await buildOrderContext(verifiedCustomerId);
	if (!orders) {
		return isUrdu
			? ["Aap signed in hain lekin abhi koi order nahi — jab order karein status yahi chat ya /account par milega."]
			: ["You are signed in but have no orders yet — when you order, status will show here or on /account."];
	}

	return isUrdu
		? [`Aap ke orders:\n${orders}`, "Kisi order par detail chahiye ho to order number likh dein ya /account khol lein."]
		: [`Your orders:\n${orders}`, "Need detail on one order? Share the order number or open /account."];
}

async function buildAccountFallback(
	verifiedCustomerId: string | undefined,
	language: CustomerMessageLanguage,
): Promise<string[] | null> {
	const isUrdu = isUrduLanguage(language);
	if (!verifiedCustomerId) {
		return isUrdu
			? ["Account ya points ke liye pehle /account par sign in karein."]
			: ["Sign in at /account to see your profile and loyalty points."];
	}

	const profile = await getAccountChatProfile(verifiedCustomerId);
	if (!profile) {
		return null;
	}

	const lines = [`Name: ${profile.name}`];
	if (profile.city) {
		lines.push(`City: ${profile.city}`);
	}
	lines.push(
		profile.loyaltyBalance !== null ? `Loyalty points: ${profile.loyaltyBalance}` : "Loyalty: not enrolled yet",
	);
	const defaultAddress = profile.addresses.find((address) => address.isDefault) ?? profile.addresses[0];
	if (defaultAddress) {
		const area = [defaultAddress.area, defaultAddress.city].filter(Boolean).join(", ");
		if (area) {
			lines.push(`Default delivery area: ${area}`);
		}
	}
	lines.push("Full address and phone: /account");

	const intro = isUrdu ? "Aap ka signed-in account summary:" : "Your signed-in account summary:";
	return [intro, lines.join("\n")];
}

/**
 * When the LLM fails, still answer from live public catalog/offers or the
 * customer's own signed-in orders/account before any generic deflection.
 */
export async function buildSmartDataFallback(input: {
	customerMessage: string;
	requiredLanguage: CustomerMessageLanguage;
	verifiedCustomerId?: string;
	subjectProductId?: string;
	subjectProductName?: string;
}): Promise<string[] | null> {
	const { customerMessage, requiredLanguage } = input;
	const isUrdu = isUrduLanguage(requiredLanguage);

	if (input.subjectProductId) {
		const subjectProduct = await getProductById(input.subjectProductId);
		if (subjectProduct && messageReferencesSubject(customerMessage, input.subjectProductName, subjectProduct)) {
			const reply = buildSingleProductReply(subjectProduct, requiredLanguage, true);
			if (reply.length) {
				return reply;
			}
		}
	}

	if (customerAskedAboutOrders(customerMessage)) {
		return buildOrderFallback(input.verifiedCustomerId, requiredLanguage);
	}

	if (customerAskedAboutAccount(customerMessage)) {
		return buildAccountFallback(input.verifiedCustomerId, requiredLanguage);
	}

	const offers = await getActiveOffersCached();
	const matchedOffers = matchOffersByMessage(offers, customerMessage);
	if (matchedOffers.length > 0) {
		return buildDealListMessageChunks({
			intro: isUrdu ? "Is message se yeh promos match hoti hain:" : "These promos match what you asked about:",
			outro: isUrdu ? "Kisi deal par product ya payment detail chahiye ho to bata dein." : "Want product or payment detail on any of these? Just ask.",
			offers: matchedOffers,
		});
	}

	if (customerAskedAboutPopular(customerMessage)) {
		const popular = await getPopularProductsCached(CATALOG_RESULT_LIMIT);
		if (popular.length > 0) {
			return buildCatalogListReply(popular, requiredLanguage, "popular");
		}
	}

	const maxBudget = extractBudgetMaxRupees(customerMessage);
	const searchQueries = extractCatalogSearchQueries(customerMessage);
	let products = await searchProductsForMessage(searchQueries, maxBudget);

	if (products.length === 0 && maxBudget) {
		products = await searchAssistantCatalogCached({
			maxPriceRupees: maxBudget,
			inStockOnly: true,
			limit: CATALOG_RESULT_LIMIT,
			sort: "price-asc",
		});
	}

	if (products.length === 1) {
		return buildSingleProductReply(products[0], requiredLanguage, false);
	}
	if (products.length > 1) {
		return buildCatalogListReply(products, requiredLanguage, maxBudget ? "budget" : "search");
	}

	const tokens = customerMessage.trim().split(/\s+/);
	if (tokens.length === 1) {
		const word = tokens[0]?.replace(/[?.!]+$/, "") ?? "";
		if (word.length >= 3 && !isChatStopWord(word)) {
			const singleWordMatches = await searchAssistantCatalogCached({
				search: word.slice(0, 80),
				limit: CATALOG_RESULT_LIMIT,
			});
			if (singleWordMatches.length === 1) {
				return buildSingleProductReply(singleWordMatches[0], requiredLanguage, false);
			}
			if (singleWordMatches.length > 1) {
				return buildCatalogListReply(singleWordMatches, requiredLanguage, "search");
			}
		}
	}

	return null;
}
