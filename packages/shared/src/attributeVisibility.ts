/**
 * Attribute visibility rules for shop filters (brand gating).
 * Product variant UI uses per-product attributeSlugs instead of parent chains.
 */

import { compareAlphabetically } from "./attributeOption";

export type AttributeVisibilityType = "always" | "brand";

export interface AttributeVisibility {
	type: AttributeVisibilityType;
	brandSlugs?: string[];
}

export const ATTRIBUTE_VISIBILITY_ALWAYS: AttributeVisibility = { type: "always" };

export interface VisibilityContext {
	brandSlug?: string;
	brandSlugs?: string[];
}

export interface AttributeVisibilityNode {
	slug: string;
	label: string;
	visibility: AttributeVisibility;
}

function normalizeSlugs(values: string[] | undefined): string[] {
	if (!values?.length) {
		return [];
	}
	return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

/** Whether an attribute row should render for the given filter context. */
export function isVisibilitySatisfied(visibility: AttributeVisibility | undefined, context: VisibilityContext): boolean {
	const rule = visibility ?? ATTRIBUTE_VISIBILITY_ALWAYS;

	switch (rule.type) {
		case "always":
			return true;
		case "brand": {
			const allowed = normalizeSlugs(rule.brandSlugs);
			if (allowed.length === 0) {
				return false;
			}
			if (context.brandSlug && allowed.includes(context.brandSlug.trim().toLowerCase())) {
				return true;
			}
			const selected = normalizeSlugs(context.brandSlugs);
			return selected.some((slug) => allowed.includes(slug));
		}
		default:
			return true;
	}
}

/** Stable display order for filter / facet attribute rows. */
export function sortAttributesByVisibility<T extends AttributeVisibilityNode>(attributes: T[]): T[] {
	return [...attributes].sort((left, right) => compareAlphabetically(left.label, right.label));
}

/** Slugs to remove from URL when brand filters change. */
export function attributeSlugsToClearOnFilterChange(attributes: AttributeVisibilityNode[], changedSlug: "brand" | string): string[] {
	if (changedSlug !== "brand") {
		return [];
	}
	return attributes
		.filter((attr) => {
			const vis = attr.visibility ?? ATTRIBUTE_VISIBILITY_ALWAYS;
			return vis.type !== "always";
		})
		.map((attr) => attr.slug);
}

export function parseAttributeVisibility(value: unknown): AttributeVisibility {
	if (!value || typeof value !== "object") {
		return ATTRIBUTE_VISIBILITY_ALWAYS;
	}
	const candidate = value as Record<string, unknown>;
	const type = candidate.type;
	if (type === "attribute" || type === "grade") {
		return ATTRIBUTE_VISIBILITY_ALWAYS;
	}
	if (type === "brand" && Array.isArray(candidate.brandSlugs)) {
		return {
			type: "brand",
			brandSlugs: candidate.brandSlugs
				.filter((str): str is string => typeof str === "string")
				.map((str) => str.trim())
				.filter(Boolean),
		};
	}
	return ATTRIBUTE_VISIBILITY_ALWAYS;
}
