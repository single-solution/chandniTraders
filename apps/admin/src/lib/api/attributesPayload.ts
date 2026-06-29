/**
 * Shared parsers for `POST /api/attributes` + `PUT /api/attributes/[id]`.
 * Attribute `unit` is shared by all options; each option slug is derived from
 * option label + attribute unit (e.g. 256 + gb → 256gb).
 */

import {
	ATTRIBUTE_OPTION_VALUE_MAX_LENGTH,
	ATTRIBUTE_UNIT_MAX_LENGTH,
	compactAttributeOptionValue,
	parseAttributeVisibility,
	sortAttributeOptions,
	type AttributeVisibility,
} from "@store/shared";

import { ATTRIBUTE_FIELD_LIMITS } from "./fieldLimits";

export interface ParsedAttributeOption {
	value: string;
	label: string;
}

export type ParseAttributeOptionsResult = { options: ParsedAttributeOption[] } | { error: string };

export function parseAttributeUnit(input: unknown): string | { error: string } {
	if (input === undefined || input === null || input === "") {
		return "";
	}
	if (typeof input !== "string") {
		return { error: "Unit must be a string." };
	}
	const trimmed = input.trim();
	if (trimmed.length > ATTRIBUTE_UNIT_MAX_LENGTH) {
		return {
			error: `Unit must be at most ${ATTRIBUTE_UNIT_MAX_LENGTH} characters.`,
		};
	}
	return trimmed;
}

export function parseAttributeOptions(input: unknown, attributeUnit = ""): ParseAttributeOptionsResult {
	if (!Array.isArray(input) || input.length === 0) {
		return { error: "Attribute must have at least one option." };
	}
	if (input.length > ATTRIBUTE_FIELD_LIMITS.optionCount) {
		return {
			error: `An attribute can have at most ${ATTRIBUTE_FIELD_LIMITS.optionCount} options.`,
		};
	}
	const unitStr = attributeUnit.trim();
	const seenValues = new Set<string>();
	const out: ParsedAttributeOption[] = [];
	for (const raw of input) {
		if (raw === null || typeof raw !== "object") {
			return { error: "Each option must be an object with a label." };
		}
		const candidate = raw as {
			label?: unknown;
		};
		const labelStr = typeof candidate.label === "string" ? candidate.label.trim() : "";
		if (labelStr.length === 0 || labelStr.length > ATTRIBUTE_FIELD_LIMITS.optionLabel) {
			return {
				error: `Option label must be 1–${ATTRIBUTE_FIELD_LIMITS.optionLabel} characters.`,
			};
		}
		const value = compactAttributeOptionValue(labelStr, unitStr, ATTRIBUTE_OPTION_VALUE_MAX_LENGTH);
		if (value.length === 0) {
			return { error: "Option slug could not be derived from label and unit." };
		}
		if (seenValues.has(value)) {
			return { error: `Duplicate option slug "${value}".` };
		}
		seenValues.add(value);
		out.push({ value, label: labelStr });
	}
	return { options: sortAttributeOptions(out, unitStr) };
}

export function parseAttributeVisibilityInput(input: unknown): AttributeVisibility | { error: string } {
	const parsed = parseAttributeVisibility(input);
	if (parsed.type === "brand") {
		if (!parsed.brandSlugs?.length) {
			return { error: "Select at least one brand for brand-gated visibility." };
		}
		return parsed;
	}
	return parsed;
}
