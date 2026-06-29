import {
	extractOfferScenarios,
	formatPrice,
	resolveOfferMinQuantity,
	type ActiveOffer,
	type AttributeDescriptor,
	type OfferCondition,
	type Product,
} from "@store/shared";

const CHECKOUT_ONLY_CONDITION_TYPES = new Set<OfferCondition["type"]>(["cart_total", "payment_method"]);
const STOREFRONT_SCOPE_CONDITION_TYPES = new Set<OfferCondition["type"]>(["categories", "brands", "products", "attributes", "price_range"]);

export interface PdpOfferRequirementsContext {
	product: Product;
	brandName: string;
	categoryAttributes: AttributeDescriptor[];
	categoryLabelsBySlug: Record<string, string>;
}

export interface PdpOfferRequirementRow {
	label: string;
	value: string;
}

export interface PdpOfferRequirementBlock {
	rows: PdpOfferRequirementRow[];
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((entry) => String(entry)).filter(Boolean);
}

function humanizeSlug(slug: string): string {
	return slug
		.split("-")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function resolveCategoryLabels(categorySlugs: string[], categoryLabelsBySlug: Record<string, string>): string {
	return categorySlugs.map((slug) => categoryLabelsBySlug[slug] ?? humanizeSlug(slug)).join(" or ");
}

function resolveBrandLabels(brandSlugs: string[], context: PdpOfferRequirementsContext): string {
	return brandSlugs
		.map((slug) => (slug === context.product.brandSlug ? context.brandName : humanizeSlug(slug)))
		.join(" or ");
}

function formatPriceRangeCondition(condition: OfferCondition): string | null {
	if (condition.type !== "price_range") {
		return null;
	}

	if (condition.operator === "between" && Array.isArray(condition.value) && condition.value.length === 2) {
		const [minimum, maximum] = condition.value as [number, number];
		return `${formatPrice(minimum)} – ${formatPrice(maximum)}`;
	}

	if (condition.operator === "gte") {
		return `${formatPrice(Number(condition.value))} or more`;
	}

	if (condition.operator === "lte") {
		return `Up to ${formatPrice(Number(condition.value))}`;
	}

	return null;
}

function formatRequirementRow(condition: OfferCondition, context: PdpOfferRequirementsContext): PdpOfferRequirementRow | null {
	if (condition.type === "categories") {
		const categorySlugs = asStringArray(condition.value);
		if (categorySlugs.length === 0) {
			return null;
		}
		return {
			label: "Category",
			value: resolveCategoryLabels(categorySlugs, context.categoryLabelsBySlug),
		};
	}

	if (condition.type === "brands") {
		const brandSlugs = asStringArray(condition.value);
		if (brandSlugs.length === 0) {
			return null;
		}
		return {
			label: "Brand",
			value: resolveBrandLabels(brandSlugs, context),
		};
	}

	if (condition.type === "products") {
		const productIds = asStringArray(condition.value);
		if (productIds.length === 0) {
			return null;
		}
		if (productIds.includes(context.product.id)) {
			return {
				label: "Product",
				value: context.product.name,
			};
		}
		return {
			label: "Product",
			value: "Selected models only",
		};
	}

	if (condition.type === "attributes") {
		const attributeFilter = condition.value;
		if (typeof attributeFilter !== "object" || attributeFilter === null || !("slug" in attributeFilter) || !("value" in attributeFilter)) {
			return null;
		}
		const { slug, value } = attributeFilter as { slug: string; value: string };
		const attribute = context.categoryAttributes.find((row) => row.slug === slug);
		const optionLabel = attribute?.options.find((option) => option.value === value)?.label ?? value;
		return {
			label: attribute?.label ?? humanizeSlug(slug),
			value: optionLabel,
		};
	}

	if (condition.type === "price_range") {
		const priceLabel = formatPriceRangeCondition(condition);
		if (!priceLabel) {
			return null;
		}
		return {
			label: "Price",
			value: priceLabel,
		};
	}

	return null;
}

const CONDITION_DISPLAY_ORDER: OfferCondition["type"][] = ["categories", "brands", "products", "attributes", "price_range"];

const REQUIREMENT_ROW_ORDER = ["Category", "Brand", "Product", "Price", "Quantity"] as const;

function sortConditionsForDisplay(conditions: OfferCondition[], categoryAttributes: AttributeDescriptor[]): OfferCondition[] {
	return [...conditions].sort((left, right) => {
		const leftTypeIndex = CONDITION_DISPLAY_ORDER.indexOf(left.type);
		const rightTypeIndex = CONDITION_DISPLAY_ORDER.indexOf(right.type);
		if (leftTypeIndex !== rightTypeIndex) {
			return (leftTypeIndex === -1 ? 99 : leftTypeIndex) - (rightTypeIndex === -1 ? 99 : rightTypeIndex);
		}

		if (left.type === "attributes" && right.type === "attributes") {
			const leftSlug = typeof left.value === "object" && left.value !== null && "slug" in left.value ? String((left.value as { slug: string }).slug) : "";
			const rightSlug = typeof right.value === "object" && right.value !== null && "slug" in right.value ? String((right.value as { slug: string }).slug) : "";
			const leftAttributeIndex = categoryAttributes.findIndex((attribute) => attribute.slug === leftSlug);
			const rightAttributeIndex = categoryAttributes.findIndex((attribute) => attribute.slug === rightSlug);
			return (leftAttributeIndex === -1 ? 99 : leftAttributeIndex) - (rightAttributeIndex === -1 ? 99 : rightAttributeIndex);
		}

		return 0;
	});
}

function sortRequirementRows(rows: PdpOfferRequirementRow[], categoryAttributes: AttributeDescriptor[]): PdpOfferRequirementRow[] {
	const fixedLabelOrder = new Map(REQUIREMENT_ROW_ORDER.map((label, index) => [label, index]));

	return [...rows].sort((left, right) => {
		const leftFixedIndex = fixedLabelOrder.get(left.label as (typeof REQUIREMENT_ROW_ORDER)[number]);
		const rightFixedIndex = fixedLabelOrder.get(right.label as (typeof REQUIREMENT_ROW_ORDER)[number]);

		if (leftFixedIndex !== undefined || rightFixedIndex !== undefined) {
			if (leftFixedIndex === undefined) {
				return 1;
			}
			if (rightFixedIndex === undefined) {
				return -1;
			}
			return leftFixedIndex - rightFixedIndex;
		}

		const leftAttributeIndex = categoryAttributes.findIndex((attribute) => attribute.label === left.label);
		const rightAttributeIndex = categoryAttributes.findIndex((attribute) => attribute.label === right.label);
		return (leftAttributeIndex === -1 ? 99 : leftAttributeIndex) - (rightAttributeIndex === -1 ? 99 : rightAttributeIndex);
	});
}

function extractRequirementConditionBundles(conditions: OfferCondition[]): OfferCondition[][] {
	const scenarios = extractOfferScenarios(conditions);
	if (scenarios.length > 0) {
		return scenarios
			.map((scenario) => {
				const subConditions = scenario.type === "group" && Array.isArray(scenario.value) ? (scenario.value as OfferCondition[]) : [];
				return subConditions.filter((condition) => !CHECKOUT_ONLY_CONDITION_TYPES.has(condition.type));
			})
			.filter((bundle) => bundle.length > 0);
	}

	const topLevelScope = conditions.filter((condition) => STOREFRONT_SCOPE_CONDITION_TYPES.has(condition.type));
	if (topLevelScope.length > 0) {
		return [topLevelScope];
	}

	return [];
}

function rowsFromConditions(conditions: OfferCondition[], context: PdpOfferRequirementsContext): PdpOfferRequirementRow[] {
	const rows: PdpOfferRequirementRow[] = [];

	for (const condition of sortConditionsForDisplay(conditions, context.categoryAttributes)) {
		const row = formatRequirementRow(condition, context);
		if (row) {
			rows.push(row);
		}
	}

	return sortRequirementRows(rows, context.categoryAttributes);
}

export function describePdpOfferRequirementBlocks(offer: ActiveOffer, context: PdpOfferRequirementsContext): PdpOfferRequirementBlock[] {
	const bundles = extractRequirementConditionBundles(offer.conditions);
	const blocks = bundles
		.map((bundle) => ({ rows: rowsFromConditions(bundle, context) }))
		.filter((block) => block.rows.length > 0);

	const minQuantity = resolveOfferMinQuantity(offer);
	const quantityOnly = minQuantity > 1 && blocks.length === 0;
	if (quantityOnly) {
		return [
			{
				rows: [
					{
						label: "Quantity",
						value: `At least ${minQuantity} units`,
					},
				],
			},
		];
	}

	if (minQuantity > 1 && blocks.length > 0) {
		const lastBlock = blocks[blocks.length - 1];
		if (lastBlock && !lastBlock.rows.some((row) => row.label === "Quantity")) {
			lastBlock.rows = sortRequirementRows(
				[
					...lastBlock.rows,
					{
						label: "Quantity",
						value: `At least ${minQuantity} units`,
					},
				],
				context.categoryAttributes,
			);
		}
	}

	return blocks;
}

function formatRequirementRowsInline(rows: PdpOfferRequirementRow[]): string {
	return rows.map((row) => `${row.label}: ${row.value}`).join(" · ");
}

export function summarizePdpOfferRequirementsInline(offer: ActiveOffer, context: PdpOfferRequirementsContext): string | null {
	const blocks = describePdpOfferRequirementBlocks(offer, context);
	if (blocks.length === 0) {
		return null;
	}
	if (blocks.length === 1) {
		const rows = blocks[0]?.rows ?? [];
		return rows.length > 0 ? formatRequirementRowsInline(rows) : null;
	}
	return blocks
		.map((block) => formatRequirementRowsInline(block.rows))
		.filter(Boolean)
		.map((line) => `(${line})`)
		.join(" or ");
}

export function describePdpOfferRequirementRows(offer: ActiveOffer, context: PdpOfferRequirementsContext): PdpOfferRequirementRow[] {
	const blocks = describePdpOfferRequirementBlocks(offer, context);
	if (blocks.length === 0) {
		return [];
	}
	if (blocks.length === 1) {
		return blocks[0]?.rows ?? [];
	}
	return blocks.flatMap((block, blockIndex) =>
		block.rows.map((row) => ({
			label: blocks.length > 1 ? `Option ${blockIndex + 1} · ${row.label}` : row.label,
			value: row.value,
		})),
	);
}
