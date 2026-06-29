import type { OfferCondition } from "./offerTypes";
import type { ActiveOffer, EvaluatableItem } from "./offerEvaluator";
import { isOfferEligible } from "./offerSchedule";

/** Checkout payment ids — matches storefront checkout panel values. */
export type OfferPaymentMethod = "bank-transfer" | "card" | "cod";

export type OfferMatchContext = {
	cartTotal: number;
	paymentMethod?: OfferPaymentMethod;
};

export type EvaluateOffersOptions = {
	paymentMethod?: OfferPaymentMethod;
};

const CHECKOUT_ONLY_CONDITION_TYPES = new Set<OfferCondition["type"]>(["cart_total", "payment_method"]);

/** Ignored for card/PDP hints — evaluated only at checkout with real cart context. */
const STOREFRONT_HINT_IGNORED_CONDITION_TYPES = new Set<OfferCondition["type"]>(["cart_total", "payment_method", "min_quantity"]);

const CHECKOUT_CONTEXT_CONDITION_TYPES = new Set<OfferCondition["type"]>(["cart_total", "payment_method", "min_quantity"]);

/** Conditions that tie an offer to catalog items (card / PDP hints). */
export function hasItemScopeConditions(offer: ActiveOffer): boolean {
	return offer.conditions.some((condition) => !CHECKOUT_ONLY_CONDITION_TYPES.has(condition.type));
}

/** Admin "storewide" scope — empty rules, applies to the whole catalog at checkout. */
export function isStorewideOffer(offer: ActiveOffer): boolean {
	return offer.conditions.length === 0;
}

function isCheckoutOnlyConditionTree(condition: OfferCondition): boolean {
	if (condition.type === "group") {
		const subConditions = condition.value as OfferCondition[];
		if (!Array.isArray(subConditions) || subConditions.length === 0) {
			return false;
		}
		return subConditions.every(isCheckoutOnlyConditionTree);
	}
	return CHECKOUT_ONLY_CONDITION_TYPES.has(condition.type);
}

/** Cart-total or payment-method scoped offers — no product/category filters. */
export function isCheckoutOnlyOffer(offer: ActiveOffer): boolean {
	if (offer.conditions.length === 0) {
		return false;
	}
	return offer.conditions.every(isCheckoutOnlyConditionTree);
}

/** Cart-total / payment-method promos — informational notices on cart and checkout (and `/deals` header). */
export function isCheckoutNoticeOffer(offer: ActiveOffer): boolean {
	return isOfferEligible(offer) && isCheckoutOnlyOffer(offer);
}

/** Exported for admin catalog overlap checks (`offerScope.ts`). */
export function matchesCondition(item: EvaluatableItem, condition: OfferCondition, context: OfferMatchContext): boolean {
	if (condition.type === "group") {
		const subConditions = condition.value as OfferCondition[];
		if (!Array.isArray(subConditions) || subConditions.length === 0) {
			return false;
		}
		if (condition.operator === "or") {
			return subConditions.some((c) => matchesCondition(item, c, context));
		}
		return subConditions.every((c) => matchesCondition(item, c, context));
	}

	let itemValue: unknown;

	switch (condition.type) {
		case "products":
			itemValue = item.productId;
			break;
		case "categories":
			itemValue = item.categorySlug;
			break;
		case "brands":
			itemValue = item.brandSlug;
			break;
		case "price_range":
			itemValue = item.price;
			break;
		case "cart_total":
			itemValue = context.cartTotal;
			break;
		case "min_quantity":
			itemValue = item.quantity;
			break;
		case "payment_method":
			if (!context.paymentMethod) {
				return false;
			}
			itemValue = context.paymentMethod;
			break;
		case "attributes": {
			const attributeFilter = condition.value;
			if (typeof attributeFilter !== "object" || attributeFilter === null || !("slug" in attributeFilter) || !("value" in attributeFilter)) {
				return false;
			}
			const { slug, value: attributeOptionValue } = attributeFilter as { slug: string; value: string };
			const attributeValue = item.attributes?.[slug];
			if (Array.isArray(attributeValue)) {
				return attributeValue.includes(attributeOptionValue);
			}
			return attributeValue === attributeOptionValue;
		}
		default:
			return false;
	}

	const targetValue = condition.value;

	switch (condition.operator) {
		case "in":
			if (Array.isArray(targetValue)) {
				return (targetValue as string[]).includes(String(itemValue));
			}
			return targetValue === itemValue;
		case "not_in":
			if (Array.isArray(targetValue)) {
				return !(targetValue as string[]).includes(String(itemValue));
			}
			return targetValue !== itemValue;
		case "between":
			if (Array.isArray(targetValue) && targetValue.length === 2) {
				const [minimum, maximum] = targetValue as [number, number];
				return (itemValue as number) >= minimum && (itemValue as number) <= maximum;
			}
			return false;
		case "gte":
			return (itemValue as number) >= Number(targetValue);
		case "lte":
			return (itemValue as number) <= Number(targetValue);
		default:
			return false;
	}
}

function itemMatchesAllConditions(item: EvaluatableItem, offer: ActiveOffer, context: OfferMatchContext, options?: { ignoreCheckoutConditions?: boolean }): boolean {
	const conditions = options?.ignoreCheckoutConditions ? offer.conditions.filter((condition) => !CHECKOUT_ONLY_CONDITION_TYPES.has(condition.type)) : offer.conditions;

	if (conditions.length === 0) {
		return !options?.ignoreCheckoutConditions;
	}

	return conditions.every((condition) => matchesCondition(item, condition, context));
}

function findSpecificItemsOrGroup(conditions: OfferCondition[]): OfferCondition | undefined {
	return conditions.find((condition) => condition.type === "group" && condition.operator === "or");
}

function matchesAndScenarioGroup(item: EvaluatableItem, scenario: OfferCondition, context: OfferMatchContext): boolean {
	if (scenario.type !== "group" || scenario.operator !== "and") {
		return false;
	}
	const subConditions = scenario.value as OfferCondition[];
	if (!Array.isArray(subConditions) || subConditions.length === 0) {
		return false;
	}
	return subConditions.every((subCondition) => matchesCondition(item, subCondition, context));
}

/** Item-scoped storefront match — OR scenarios win; checkout/qty rules apply only at cart. */
export function itemMatchesStorefrontScope(item: EvaluatableItem, offer: ActiveOffer, context: OfferMatchContext): boolean {
	const orGroup = findSpecificItemsOrGroup(offer.conditions);
	if (orGroup) {
		const scenarios = (orGroup.value as OfferCondition[]).filter((condition) => condition.type === "group" && condition.operator === "and");
		if (scenarios.length > 0) {
			return scenarios.some((scenario) => matchesAndScenarioGroup(item, scenario, context));
		}
	}

	const scopeConditions = offer.conditions.filter((condition) => !STOREFRONT_HINT_IGNORED_CONDITION_TYPES.has(condition.type));

	if (scopeConditions.length === 0) {
		return false;
	}

	return scopeConditions.every((condition) => matchesCondition(item, condition, context));
}

function getCheckoutCompanionConditions(conditions: OfferCondition[], orGroup: OfferCondition | undefined): OfferCondition[] {
	return conditions.filter((condition) => {
		if (condition === orGroup) {
			return false;
		}
		if (CHECKOUT_CONTEXT_CONDITION_TYPES.has(condition.type)) {
			return true;
		}
		if (orGroup) {
			return false;
		}
		return true;
	});
}

/** Full offer match for cart/checkout — OR scenarios + qty/cart/payment rules. */
export function itemMatchesOfferConditions(item: EvaluatableItem, offer: ActiveOffer, context: OfferMatchContext): boolean {
	if (!isOfferEligible(offer)) {
		return false;
	}

	const orGroup = findSpecificItemsOrGroup(offer.conditions);
	if (orGroup) {
		const scenarios = (orGroup.value as OfferCondition[]).filter((condition) => condition.type === "group" && condition.operator === "and");
		const scenarioMatched = scenarios.length > 0 ? scenarios.some((scenario) => matchesAndScenarioGroup(item, scenario, context)) : matchesCondition(item, orGroup, context);
		if (!scenarioMatched) {
			return false;
		}
		const companionConditions = getCheckoutCompanionConditions(offer.conditions, orGroup);
		return companionConditions.every((condition) => matchesCondition(item, condition, context));
	}

	return itemMatchesAllConditions(item, offer, context);
}

/** Offers to hint on product cards / PDP (ignores cart total + payment method). */
export function getStorefrontItemOffers(item: EvaluatableItem, offers: ActiveOffer[], cartTotal?: number): ActiveOffer[] {
	const context: OfferMatchContext = {
		cartTotal: cartTotal ?? item.price * item.quantity,
	};

	return offers.filter((offer) => {
		if (!isOfferEligible(offer)) {
			return false;
		}
		if (isCheckoutOnlyOffer(offer)) {
			return false;
		}
		if (!hasItemScopeConditions(offer)) {
			return false;
		}
		return itemMatchesStorefrontScope(item, offer, context);
	});
}

export function getMatchedCartItems(items: EvaluatableItem[], offer: ActiveOffer, context: OfferMatchContext): EvaluatableItem[] {
	const matchedItems: EvaluatableItem[] = [];
	for (const item of items) {
		if (itemMatchesOfferConditions(item, offer, context)) {
			matchedItems.push(item);
		}
	}
	return matchedItems;
}

/** Whole-cart offers with no item conditions — evaluated once against cart context. */
export function cartMatchesOffer(offer: ActiveOffer, context: OfferMatchContext): boolean {
	if (offer.conditions.length === 0) {
		return true;
	}
	const syntheticItem: EvaluatableItem = {
		id: "cart",
		productId: "",
		variantId: "",
		categorySlug: "",
		brandSlug: "",
		price: context.cartTotal,
		quantity: 1,
		attributes: {},
	};
	return itemMatchesAllConditions(syntheticItem, offer, context);
}
