/**
 * Helpers for admin-authored attribute options. Each option stores a
 * display `label` (e.g. "256"), optional `unit` (e.g. "gb"), and a
 * compact `value` slug used in variant maps and filter URLs (e.g. "256gb").
 */

/** Max length for persisted option `value` slugs — keep in sync with Mongoose. */
export const ATTRIBUTE_OPTION_VALUE_MAX_LENGTH = 60;

/** Max length for attribute-level `unit` — keep in sync with Mongoose. */
export const ATTRIBUTE_UNIT_MAX_LENGTH = 20;

/**
 * Canonical option slug: lowercase alphanumeric join of label + unit
 * (no hyphens), e.g. label "256" + unit "gb" → "256gb".
 */
export function compactAttributeOptionValue(label: string, unit = "", maxLength = ATTRIBUTE_OPTION_VALUE_MAX_LENGTH): string {
	const combined = `${label.trim()}${unit.trim()}`.toLowerCase();
	const slug = combined.replace(/[^a-z0-9]+/g, "");
	return slug.slice(0, maxLength);
}

/** Case-insensitive alphabetical compare with numeric-aware ordering. */
export function compareAlphabetically(left: string, right: string): number {
	return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

/** Customer-facing label, e.g. "256" + "gb" → "256 gb". */
export function formatAttributeOptionLabel(label: string, unit?: string): string {
	const trimmedLabel = label.trim();
	const trimmedUnit = unit?.trim() ?? "";
	if (!trimmedLabel) {
		return trimmedUnit;
	}
	if (!trimmedUnit) {
		return trimmedLabel;
	}
	return `${trimmedLabel} ${trimmedUnit}`;
}

/** Attribute options are always shown in alphabetical display order (no manual sort). */
export function sortAttributeOptions<T extends { label: string }>(options: T[], unit?: string): T[] {
	return [...options].sort((left, right) => compareAlphabetically(formatAttributeOptionLabel(left.label, unit), formatAttributeOptionLabel(right.label, unit)));
}

/** Minimal attribute shape for resolving a variant's stored value to a label. */
export interface AttributeLabelSource {
	slug: string;
	label: string;
	unit?: string;
	options: Array<{ value: string; label: string }>;
}

/** Resolve a variant attribute value to a customer-facing label. */
export function resolveVariantAttributeLabel(attribute: AttributeLabelSource, value: string, attributeDisplay?: Record<string, string>): string {
	const global = attribute?.options?.find((option) => option.value.toLowerCase() === value.toLowerCase());
	if (global) {
		return formatAttributeOptionLabel(global.label, attribute.unit);
	}
	const custom = attributeDisplay?.[attribute.slug]?.trim();
	if (custom) {
		return custom;
	}
	return value;
}

/** Comma-separated summary of variant attributes for PDP / WhatsApp copy. */
export function formatVariantAttributeSummary(
	attributes: Record<string, string | string[]>,
	definitions: AttributeLabelSource[],
	attributeDisplay?: Record<string, string>,
): string {
	const parts: string[] = [];
	for (const definition of definitions) {
		const raw = attributes?.[definition.slug];
		if (!raw) {
			continue;
		}
		const values = Array.isArray(raw) ? raw : [raw];
		const labels = values.filter((value) => value.length > 0).map((value) => resolveVariantAttributeLabel(definition, value, attributeDisplay));
		if (labels.length > 0) {
			parts.push(labels.join(" / "));
		}
	}
	return parts.join(", ");
}
