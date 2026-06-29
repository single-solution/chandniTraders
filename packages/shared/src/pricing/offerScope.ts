import type { OfferCondition, OfferAction, OfferConstraints } from "./offerTypes";
import type { EvaluatableItem, ActiveOffer } from "./offerEvaluator";
import { isOfferEligible } from "./offerSchedule";
import { isCheckoutOnlyOffer, isStorewideOffer, matchesCondition } from "./offerMatching";

const CATALOG_CONDITION_TYPES = new Set<OfferCondition["type"]>(["categories", "brands", "products", "attributes"]);

export interface OfferCatalogProductVariant {
	attributes: Record<string, string | string[]>;
}

/** Minimal product shape for catalog overlap checks. */
export interface OfferCatalogProduct {
	id: string;
	name: string;
	categorySlug: string;
	brandSlug: string;
	variants: OfferCatalogProductVariant[];
}

export interface OfferScopeConflict {
	conflictingOfferId: string;
	conflictingOfferTitle: string;
	productId: string;
	productName: string;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((entry) => String(entry)).filter(Boolean);
}

/** Scenario = AND group inside the specific-items OR group (or a flat AND of catalog conditions). */
export function extractOfferScenarios(conditions: OfferCondition[]): OfferCondition[] {
	const orGroup = conditions.find((condition) => condition.type === "group" && condition.operator === "or");
	if (orGroup && Array.isArray(orGroup.value)) {
		const scenarios = (orGroup.value as OfferCondition[]).filter((condition) => condition.type === "group" && condition.operator === "and");
		if (scenarios.length > 0) {
			return scenarios;
		}
	}

	const flatCatalogConditions = conditions.filter((condition) => CATALOG_CONDITION_TYPES.has(condition.type));
	if (flatCatalogConditions.length > 0) {
		return [{ type: "group", operator: "and", value: flatCatalogConditions }];
	}

	return [];
}

function isCompleteCatalogScenario(scenario: OfferCondition): boolean {
	const subs = scenarioCatalogConditions(scenario);
	const categorySlugs = asStringArray(subs.find((condition) => condition.type === "categories")?.value);
	const productIds = asStringArray(subs.find((condition) => condition.type === "products")?.value);
	return categorySlugs.length > 0 || productIds.length > 0;
}

/** Catalog deal with at least one category or product per scenario — storewide (empty rules) excluded. */
export function hasValidCatalogDealScope(conditions: OfferCondition[]): boolean {
	if (isStorewideOffer({ conditions } as ActiveOffer)) {
		return false;
	}
	if (isCheckoutOnlyOffer({ conditions } as ActiveOffer)) {
		return false;
	}
	const scenarios = extractOfferScenarios(conditions);
	return scenarios.some((scenario) => isCompleteCatalogScenario(scenario));
}

/** User-facing validation before save — null when valid or checkout-only. */
export function validateCatalogOfferConditions(conditions: OfferCondition[]): string | null {
	if (isCheckoutOnlyOffer({ conditions } as ActiveOffer)) {
		return null;
	}
	if (isStorewideOffer({ conditions } as ActiveOffer)) {
		return "Pick a category or product — storewide offers are not allowed.";
	}
	if (!hasValidCatalogDealScope(conditions)) {
		return "Each catalog scenario needs at least one category or a specific product.";
	}
	return null;
}

const CATALOG_DEAL_ACTION_TYPES = new Set<OfferAction["type"]>(["percentage_discount", "fixed_amount_discount"]);

/** Catalog deals — percentage or fixed discount on matched line items only. */
export function isCatalogDealAction(action: Pick<OfferAction, "type">): boolean {
	return CATALOG_DEAL_ACTION_TYPES.has(action.type);
}

/** Coerce legacy catalog actions (e.g. free shipping) to a supported catalog discount. */
export function normalizeCatalogOfferAction(action: OfferAction): OfferAction {
	if (isCatalogDealAction(action) && action.target === "matched_items") {
		return action;
	}
	if (action.type === "percentage_discount" || action.type === "fixed_amount_discount") {
		return { ...action, target: "matched_items" };
	}
	const fallbackValue = action.value > 0 ? action.value : 10;
	return { type: "percentage_discount", value: fallbackValue, target: "matched_items" };
}

/** Validates catalog offer action shape — null when valid or checkout-only. */
export function validateCatalogOfferAction(conditions: OfferCondition[], action: OfferAction): string | null {
	if (isCheckoutOnlyOffer({ conditions } as ActiveOffer)) {
		return null;
	}
	if (!hasValidCatalogDealScope(conditions)) {
		return null;
	}
	if (!isCatalogDealAction(action)) {
		return "Catalog deals support percentage or fixed discounts only. Use checkout offers for free shipping.";
	}
	if (action.target !== "matched_items") {
		return "Catalog deals must apply to matched items.";
	}
	return null;
}

/** Conditions + action validation for catalog offers. */
export function validateCatalogOfferRules(conditions: OfferCondition[], action: OfferAction): string | null {
	return validateCatalogOfferConditions(conditions) ?? validateCatalogOfferAction(conditions, action);
}

/** Catalog deals never control loyalty — checkout offers keep the admin toggle. */
export function normalizeOfferConstraintsForScope(conditions: OfferCondition[], constraints: OfferConstraints): OfferConstraints {
	if (isCheckoutOnlyOffer({ conditions } as ActiveOffer)) {
		return constraints;
	}
	if (hasValidCatalogDealScope(conditions)) {
		return { ...constraints, allowLoyaltyPoints: false };
	}
	return constraints;
}

export function offerHasCatalogItemScope(conditions: OfferCondition[]): boolean {
	return hasValidCatalogDealScope(conditions);
}

/** Item-scoped catalog promos — selectable deal buttons on `/deals` and the shop hero. */
export function isCatalogDealOffer(offer: ActiveOffer): boolean {
	return isOfferEligible(offer) && !isCheckoutOnlyOffer(offer) && hasValidCatalogDealScope(offer.conditions);
}

function scenarioCatalogConditions(scenario: OfferCondition): OfferCondition[] {
	if (scenario.type !== "group" || scenario.operator !== "and" || !Array.isArray(scenario.value)) {
		return [];
	}
	return (scenario.value as OfferCondition[]).filter((condition) => CATALOG_CONDITION_TYPES.has(condition.type));
}

function productMatchesScenario(product: OfferCatalogProduct, scenario: OfferCondition): boolean {
	const catalogConditions = scenarioCatalogConditions(scenario);
	if (catalogConditions.length === 0) {
		return false;
	}

	const context = { cartTotal: 0 };
	for (const [variantIndex, variant] of product.variants.entries()) {
		const item: EvaluatableItem = {
			id: `${product.id}:${variantIndex}`,
			productId: product.id,
			variantId: "",
			categorySlug: product.categorySlug,
			brandSlug: product.brandSlug,
			price: 0,
			quantity: 1,
			attributes: variant.attributes ?? {},
		};
		if (catalogConditions.every((condition) => matchesCondition(item, condition, context))) {
			return true;
		}
	}

	return false;
}

function productMatchesOfferCatalogScope(product: OfferCatalogProduct, conditions: OfferCondition[]): boolean {
	const scenarios = extractOfferScenarios(conditions);
	if (scenarios.length === 0) {
		return false;
	}
	return scenarios.some((scenario) => productMatchesScenario(product, scenario));
}

/**
 * Returns the first catalog product that would match both offer condition sets.
 * Parent scopes (category / brand) and child scopes (specific product) overlap
 * when any single product matches both.
 */
export function findOfferCatalogScopeConflict(
	candidateConditions: OfferCondition[],
	existingOffers: Array<{ id: string; title: string; conditions: OfferCondition[] }>,
	products: OfferCatalogProduct[],
	excludeOfferId?: string,
): OfferScopeConflict | null {
	if (!offerHasCatalogItemScope(candidateConditions)) {
		return null;
	}

	const peers = existingOffers.filter((offer) => offer.id !== excludeOfferId && offerHasCatalogItemScope(offer.conditions));

	for (const peer of peers) {
		for (const product of products) {
			if (productMatchesOfferCatalogScope(product, candidateConditions) && productMatchesOfferCatalogScope(product, peer.conditions)) {
				return {
					conflictingOfferId: peer.id,
					conflictingOfferTitle: peer.title,
					productId: product.id,
					productName: product.name,
				};
			}
		}
	}

	return null;
}

export function formatOfferScopeConflictMessage(conflict: OfferScopeConflict): string {
	return `"${conflict.productName}" already matches catalog deal "${conflict.conflictingOfferTitle}". A product cannot belong to two catalog deals — checkout offers are separate.`;
}

/** Whether picking this product in a scenario would overlap another offer. */
export function wouldProductSelectionConflict(
	candidateConditions: OfferCondition[],
	scenarioIndex: number,
	product: OfferCatalogProduct,
	existingOffers: Array<{ id: string; title: string; conditions: OfferCondition[] }>,
	excludeOfferId?: string,
): OfferScopeConflict | null {
	const hypothetical = setScenarioProductAtIndex(candidateConditions, scenarioIndex, product.id);
	return findOfferCatalogScopeConflict(hypothetical, existingOffers, [product], excludeOfferId);
}

function setScenarioProductAtIndex(conditions: OfferCondition[], scenarioIndex: number, productId: string): OfferCondition[] {
	const next = structuredClone(conditions) as OfferCondition[];
	const orIndex = next.findIndex((condition) => condition.type === "group" && condition.operator === "or");
	if (orIndex === -1) {
		return next;
	}
	const orGroup = next[orIndex];
	if (!Array.isArray(orGroup.value) || orGroup.value.length === 0) {
		return next;
	}
	const scenarios = orGroup.value as OfferCondition[];
	if (!scenarios[scenarioIndex]) {
		return next;
	}
	const scenario = scenarios[scenarioIndex];
	if (scenario.type !== "group" || !Array.isArray(scenario.value)) {
		return next;
	}
	const subs = [...(scenario.value as OfferCondition[])];
	const productIndex = subs.findIndex((condition) => condition.type === "products");
	if (productIndex > -1) {
		subs[productIndex] = { type: "products", operator: "in", value: [productId] };
	} else {
		subs.push({ type: "products", operator: "in", value: [productId] });
	}
	scenarios[scenarioIndex] = { type: "group", operator: "and", value: subs };
	orGroup.value = scenarios;
	next[orIndex] = orGroup;
	return next;
}

function setScenarioProduct(conditions: OfferCondition[], productId: string): OfferCondition[] {
	return setScenarioProductAtIndex(conditions, 0, productId);
}

export function summarizeScenarioScope(scenario: OfferCondition): {
	categorySlugs: string[];
	brandSlugs: string[];
	productIds: string[];
} {
	const subs = scenarioCatalogConditions(scenario);
	const pick = (type: OfferCondition["type"]) => asStringArray(subs.find((condition) => condition.type === type)?.value);
	return {
		categorySlugs: pick("categories"),
		brandSlugs: pick("brands"),
		productIds: pick("products"),
	};
}
