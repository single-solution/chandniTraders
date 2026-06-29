/**
 * Listing-derived attribute facets for progressive shop filters.
 */

import {
	compareAlphabetically,
	isVisibilitySatisfied,
	resolveVariantAttributeLabel,
	sortAttributesByVisibility,
	type AttributeVisibility,
	type VisibilityContext,
} from "@store/shared";
import { toAttributeLabelSource } from "@/lib/catalog/attributeLabels";
import { Attribute as AttributeModel, connectDB, Product as ProductModel } from "@store/db";

import { buildTopLevelMatch, buildVariantElemMatch, type ProductFilters } from "@/lib/core/queries";
import { toAttribute, type AttributeLean } from "@/lib/core/serializers";

export interface FacetOption {
	value: string;
	label: string;
	count: number;
}

export interface AttributeFacet {
	slug: string;
	label: string;
	unit?: string;
	options: FacetOption[];
}

function filtersToVisibilityContext(filters: ProductFilters): VisibilityContext {
	return {
		brandSlugs: filters.brandSlugs,
	};
}

type AttributeDescriptor = ReturnType<typeof toAttribute>;

function resolveFacetLabel(attribute: AttributeDescriptor, value: string, customLabel?: string): string {
	const display = customLabel?.trim() ? { [attribute.slug]: customLabel.trim() } : undefined;
	return resolveVariantAttributeLabel(toAttributeLabelSource(attribute), value, display);
}

/**
 * Attribute filter groups with option values taken from variants in the
 * current listing (same match as the product grid), not the full admin
 * template list.
 */
export async function getFacets(filters: ProductFilters): Promise<AttributeFacet[]> {
	if (!filters.categorySlug) {
		return [];
	}

	await connectDB();

	const attributeDocs = await AttributeModel.find({
		categorySlug: filters.categorySlug,
		isActive: true,
	}).lean<AttributeLean[]>();

	const descriptors = attributeDocs.map(toAttribute);
	const visibilityContext = filtersToVisibilityContext(filters);
	const visibleNodes = sortAttributesByVisibility(
		descriptors
			.filter((attribute) => isVisibilitySatisfied(attribute.visibility as AttributeVisibility | undefined, visibilityContext))
			.map((attribute) => ({
				slug: attribute.slug,
				label: attribute.label,
				visibility: (attribute.visibility ?? { type: "always" }) as AttributeVisibility,
			})),
	);
	const visible = visibleNodes.map((node) => descriptors.find((row) => row.slug === node.slug)).filter((row): row is AttributeDescriptor => Boolean(row));

	if (visible.length === 0) {
		return [];
	}

	const visibleSlugs = new Set(visible.map((attribute) => attribute.slug));
	const topMatch = buildTopLevelMatch(filters);
	const variantMatch = buildVariantElemMatch(filters);
	const matchStage: Record<string, unknown> = { ...topMatch };
	if (variantMatch) {
		matchStage.variants = { $elemMatch: variantMatch };
	}

	const variantRows = await ProductModel.aggregate<{
		attributes: Record<string, string>;
		attributeDisplay?: Record<string, string>;
	}>([
		{ $match: matchStage },
		{ $unwind: "$variants" },
		...(variantMatch
			? [
					{
						$match: Object.fromEntries(Object.entries(variantMatch).map(([key, value]) => [`variants.${key}`, value])),
					},
				]
			: []),
		{
			$project: {
				attributes: "$variants.attributes",
				attributeDisplay: "$variants.attributeDisplay",
			},
		},
	]);

	type CountKey = `${string}\0${string}`;
	const counts = new Map<CountKey, number>();
	const customLabels = new Map<CountKey, string>();

	for (const row of variantRows) {
		const attributes = row.attributes ?? {};
		const display = row.attributeDisplay ?? {};
		for (const [slug, raw] of Object.entries(attributes)) {
			if (!visibleSlugs.has(slug)) {
				continue;
			}
			const values = Array.isArray(raw)
				? raw.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
				: typeof raw === "string" && raw.trim().length > 0
					? [raw]
					: [];
			for (const value of values) {
				const key = `${slug}\0${value}` as CountKey;
				counts.set(key, (counts.get(key) ?? 0) + 1);
				const custom = display[slug];
				if (custom?.trim() && !customLabels.has(key)) {
					customLabels.set(key, custom.trim());
				}
			}
		}
	}

	return visible.map((attribute) => {
		const options: FacetOption[] = [];
		for (const [compound, count] of counts) {
			const [slug, value] = compound.split("\0");
			if (slug !== attribute.slug) {
				continue;
			}
			options.push({
				value,
				label: resolveFacetLabel(attribute, value, customLabels.get(compound)),
				count,
			});
		}
		options.sort((left, right) => compareAlphabetically(left.label, right.label));
		return {
			slug: attribute.slug,
			label: attribute.label,
			unit: attribute.unit,
			options,
		};
	});
}
