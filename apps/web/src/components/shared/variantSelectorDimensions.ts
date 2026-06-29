"use client";

import {
	getProductOptionPool,
	resolveVariantAttributeLabel,
	type AttributeDescriptor,
	type Product,
	type ProductAttributeConfig,
	type Variant,
	isVariantInStock,
} from "@store/shared";

import { toAttributeLabelSource } from "@/lib/catalog/attributeLabels";
import { attributeValuesOnVariant, findVariantBySelection } from "@/lib/catalog/pdpSelection";

export const EMPTY_VARIANT: Variant = {
	id: "",
	priceRupees: 0,
	quantity: 0,
	forceOutOfStock: false,
	warrantyDays: 0,
	attributes: {},
};

export interface DimensionOption {
	key: string;
	label: string;
	backgroundColor?: string;
}

export interface Dimension {
	key: string;
	label: string;
	options: DimensionOption[];
}

export function formatMissingPrompt(attributeLabels: string[]): string {
	if (attributeLabels.length === 0) {
		return "Select options to see price";
	}
	if (attributeLabels.length === 1) {
		return `Select ${attributeLabels[0]} to see price`;
	}
	if (attributeLabels.length === 2) {
		return `Select ${attributeLabels[0]} and ${attributeLabels[1]} to see price`;
	}
	const head = attributeLabels.slice(0, -1).join(", ");
	const tail = attributeLabels[attributeLabels.length - 1];
	return `Select ${head}, and ${tail} to see price`;
}

export function buildDimensions(product: Product, attributeDefinitions: AttributeDescriptor[], productConfig?: ProductAttributeConfig): Dimension[] {
	const dimensions: Dimension[] = [];

	for (const attribute of attributeDefinitions) {
		const allowedPool = productConfig ? new Set(getProductOptionPool(productConfig, attribute.slug, attribute).map((value) => value.toLowerCase())) : undefined;
		const options = collectAttributeOptions(product.variants, attribute, allowedPool);
		if (options.length === 0) {
			continue;
		}
		dimensions.push({
			key: attribute.slug,
			label: attribute.label,
			options,
		});
	}

	return dimensions;
}

function collectAttributeOptions(variants: Variant[], attribute: AttributeDescriptor, allowedPool?: Set<string>): DimensionOption[] {
	const seen = new Map<string, DimensionOption>();
	const source = toAttributeLabelSource(attribute);

	for (const variant of variants) {
		for (const value of attributeValuesOnVariant(variant, attribute.slug)) {
			if (allowedPool && !allowedPool.has(value.toLowerCase())) {
				continue;
			}
			if (seen.has(value)) {
				continue;
			}
			seen.set(value, {
				key: value,
				label: resolveVariantAttributeLabel(source, value, variant.attributeDisplay),
			});
		}
	}
	return Array.from(seen.values());
}

type OptionStateValue = "selected" | "available" | "unavailable" | "out_of_stock";

export function computeOptionState(dimensionKey: string, optionKey: string, variants: Variant[], currentSelection: Record<string, string>): OptionStateValue {
	if (currentSelection[dimensionKey] === optionKey) {
		return "selected";
	}
	const probe = { ...currentSelection, [dimensionKey]: optionKey };
	const exact = findVariantBySelection(variants, probe);
	if (exact) {
		return isVariantInStock(exact) ? "available" : "out_of_stock";
	}
	const withValue = variants.filter((variant) => attributeValuesOnVariant(variant, dimensionKey).includes(optionKey));
	if (withValue.length === 0) {
		return "unavailable";
	}
	const hasStock = withValue.some((variant) => isVariantInStock(variant));
	return hasStock ? "available" : "out_of_stock";
}

export function variantsForUpstreamSelection(variants: Variant[], dimensions: Dimension[], dimensionIndex: number, selection: Record<string, string>): Variant[] {
	const upstreamDimensions = dimensions.slice(0, dimensionIndex);
	return variants.filter((variant) =>
		upstreamDimensions.every((dimension) => {
			const picked = selection[dimension.key];
			if (!picked) {
				return true;
			}
			return attributeValuesOnVariant(variant, dimension.key).includes(picked);
		}),
	);
}

export function filterOptionsForUpstreamSelection(
	dimension: Dimension,
	dimensionIndex: number,
	dimensions: Dimension[],
	variants: Variant[],
	selection: Record<string, string>,
): DimensionOption[] {
	const scoped = variantsForUpstreamSelection(variants, dimensions, dimensionIndex, selection);
	return dimension.options.filter((option) => scoped.some((variant) => attributeValuesOnVariant(variant, dimension.key).includes(option.key)));
}

export function buildConfiguratorIntroHint(dimensions: Dimension[]): string | null {
	if (dimensions.length <= 1) {
		return null;
	}
	const firstLabel = dimensions[0]?.label.toLowerCase();
	if (!firstLabel) {
		return null;
	}
	return `Pick ${firstLabel} first — the options below update to match.`;
}

export function buildDimensionRowHint(dimension: Dimension, dimensionIndex: number, dimensions: Dimension[], selection: Record<string, string>): string | null {
	if (dimensions.length <= 1) {
		return null;
	}
	if (dimensionIndex === 0) {
		return "Pick this first — the rows below update to match.";
	}
	const upstreamLabels = dimensions.slice(0, dimensionIndex).flatMap((upstream) => {
		const picked = selection[upstream.key];
		if (!picked) {
			return [];
		}
		return [optionLabelForKey(upstream, picked)];
	});
	if (upstreamLabels.length === 0) {
		return null;
	}
	return `Showing ${dimension.label.toLowerCase()} options for ${upstreamLabels.join(" · ")}.`;
}

export function formatDimensionOverview(dimensions: Dimension[], variants: Variant[]): string | null {
	const parts = dimensions
		.map((dimension) => {
			const options = filterOptionsForUpstreamSelection(dimension, 0, dimensions, variants, {});
			if (options.length <= 1) {
				return null;
			}
			return `${options.length} ${dimension.label.toLowerCase()} options`;
		})
		.filter((part): part is string => Boolean(part));

	if (parts.length === 0) {
		return null;
	}
	return parts.join(" · ");
}

export function formatConfigurationSummary(dimensions: Dimension[], selection: Record<string, string>): string | null {
	const parts: string[] = [];
	for (const dimension of dimensions) {
		const key = selection[dimension.key];
		if (!key) {
			continue;
		}
		parts.push(optionLabelForKey(dimension, key));
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

export function describePickRealignment(
	dimensions: Dimension[],
	before: Record<string, string>,
	after: Record<string, string>,
	clickedDimensionKey: string,
): string | null {
	const adjustedLabels: string[] = [];
	for (const dimension of dimensions) {
		if (dimension.key === clickedDimensionKey) {
			continue;
		}
		const previousKey = before[dimension.key];
		const nextKey = after[dimension.key];
		if (!nextKey || previousKey === nextKey) {
			continue;
		}
		adjustedLabels.push(optionLabelForKey(dimension, nextKey));
	}

	if (adjustedLabels.length === 0) {
		return null;
	}

	const clickedDimension = dimensions.find((dimension) => dimension.key === clickedDimensionKey);
	const clickedLabel = clickedDimension ? optionLabelForKey(clickedDimension, after[clickedDimensionKey] ?? "") : after[clickedDimensionKey];
	const subject = formatClickedSubject(clickedDimension, clickedLabel);
	const includes = joinNaturalList(adjustedLabels);

	return `${subject} has ${includes}.`;
}

function optionLabelForKey(dimension: Dimension, key: string): string {
	return dimension.options.find((option) => option.key === key)?.label ?? key;
}

function formatClickedSubject(clickedDimension: Dimension | undefined, clickedLabel: string): string {
	if (!clickedDimension?.label) {
		return clickedLabel;
	}
	return `${clickedLabel} ${clickedDimension.label.toLowerCase()}`;
}

function joinNaturalList(parts: string[]): string {
	if (parts.length === 1) {
		return parts[0] ?? "";
	}
	if (parts.length === 2) {
		return `${parts[0]} and ${parts[1]}`;
	}
	return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function describeSelection(variant: Variant, attributes: AttributeDescriptor[]): string {
	const parts: string[] = [];
	for (const attribute of attributes) {
		const raw = variant.attributes?.[attribute.slug];
		if (!raw) continue;
		const values = Array.isArray(raw) ? raw : [raw];
		const source = toAttributeLabelSource(attribute);
		const labels = values.map((value) => resolveVariantAttributeLabel(source, value, variant.attributeDisplay)).filter((label) => label.length > 0);
		if (labels.length > 0) {
			parts.push(labels.join(" · "));
		}
	}
	return parts.join(" · ");
}
