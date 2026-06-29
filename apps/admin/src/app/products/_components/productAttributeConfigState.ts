import {
	compactAttributeOptionValue,
	formatAttributeOptionLabel,
	getProductOptionPool,
	hasExplicitProductAttributeConfig,
	resolveProductAttributeConfig,
	type ProductAttributeConfig,
	type ProductCustomOption,
} from "@store/shared";

import type { AdminAttribute, AdminProduct, AdminVariant } from "@/types/models";

function normalizePoolValues(values: string[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const value of values) {
		const entry = value.trim().toLowerCase();
		if (!entry || seen.has(entry)) {
			continue;
		}
		seen.add(entry);
		normalized.push(entry);
	}
	return normalized;
}

function toCategoryAttributeRefs(attributes: AdminAttribute[]) {
	return attributes.map((attribute) => ({
		slug: attribute.slug,
		options: attribute.options,
	}));
}

export function attributeConfigFromProduct(
	product: Pick<AdminProduct, "attributeSlugs" | "attributeOptionPool" | "attributeCustomOptions" | "attributeDefaults" | "variants">,
	categoryAttributes: AdminAttribute[],
): ProductAttributeConfig {
	return resolveProductAttributeConfig(
		{
			attributeSlugs: product.attributeSlugs,
			attributeOptionPool: product.attributeOptionPool,
			attributeCustomOptions: product.attributeCustomOptions,
			attributeDefaults: product.attributeDefaults,
			variants: product.variants,
		},
		toCategoryAttributeRefs(categoryAttributes),
	);
}

/**
 * Editor state: mirror what is stored on the product document. Do not expand
 * missing pool keys via resolve — that made saves look like they did nothing.
 */
export function attributeConfigForEditor(
	product: Pick<AdminProduct, "attributeSlugs" | "attributeOptionPool" | "attributeCustomOptions" | "attributeDefaults">,
	categoryAttributes: AdminAttribute[],
): ProductAttributeConfig {
	if (!hasExplicitProductAttributeConfig(product)) {
		return attributeConfigForCategory(categoryAttributes);
	}

	const categorySlugSet = new Set(categoryAttributes.map((attribute) => attribute.slug));
	const attributeSlugs = (product.attributeSlugs ?? []).map((slug) => slug.trim().toLowerCase()).filter((slug) => categorySlugSet.has(slug));

	const attributeOptionPool: Record<string, string[]> = {};
	for (const slug of attributeSlugs) {
		const attribute = categoryAttributes.find((row) => row.slug === slug);
		const stored = product.attributeOptionPool?.[slug];
		if (Array.isArray(stored)) {
			attributeOptionPool[slug] = normalizePoolValues(stored);
		} else if (attribute) {
			attributeOptionPool[slug] = attribute.options.map((option) => option.value.toLowerCase());
		} else {
			attributeOptionPool[slug] = [];
		}
	}

	const normalizedCustom: Record<string, ProductCustomOption[]> = {};
	for (const slug of attributeSlugs) {
		const options = product.attributeCustomOptions?.[slug] ?? [];
		if (options.length === 0) {
			continue;
		}
		normalizedCustom[slug] = options.map((option) => ({
			value: option.value.toLowerCase(),
			label: option.label.trim(),
		}));
	}

	const attributeDefaults: Record<string, string> = {};
	if (product.attributeDefaults) {
		for (const slug of attributeSlugs) {
			const value = product.attributeDefaults[slug];
			if (typeof value === "string" && value.length > 0) {
				attributeDefaults[slug] = value.toLowerCase();
			}
		}
	}

	return {
		attributeSlugs,
		attributeOptionPool,
		...(Object.keys(normalizedCustom).length > 0 ? { attributeCustomOptions: normalizedCustom } : {}),
		...(Object.keys(attributeDefaults).length > 0 ? { attributeDefaults } : {}),
	};
}

/** Default config for a category before the product is saved (all attributes + options). */
export function attributeConfigForCategory(categoryAttributes: AdminAttribute[]): ProductAttributeConfig {
	return resolveProductAttributeConfig({}, toCategoryAttributeRefs(categoryAttributes));
}

/** Effective enabled values for one attribute (undefined pool key = all global options). */
export function effectiveProductOptionPool(config: ProductAttributeConfig, attribute: AdminAttribute): string[] {
	return getProductOptionPool(config, attribute.slug, {
		slug: attribute.slug,
		options: attribute.options,
	});
}

/** Exact payload for PUT /api/products/:id/attribute-config — no implicit pool expansion. */
export function buildAttributeConfigForSave(config: ProductAttributeConfig, categoryAttributes: AdminAttribute[]) {
	const attributeSlugs = config.attributeSlugs.map((slug) => slug.trim().toLowerCase());
	const attributeOptionPool: Record<string, string[]> = {};

	for (const slug of attributeSlugs) {
		const attribute = categoryAttributes.find((row) => row.slug === slug);
		const stored = config.attributeOptionPool[slug];
		if (Array.isArray(stored)) {
			attributeOptionPool[slug] = normalizePoolValues(stored);
		} else if (attribute) {
			attributeOptionPool[slug] = attribute.options.map((option) => option.value.toLowerCase());
		} else {
			attributeOptionPool[slug] = [];
		}
	}

	return {
		attributeSlugs,
		attributeOptionPool,
		attributeCustomOptions: config.attributeCustomOptions ?? {},
		attributeDefaults: config.attributeDefaults ?? {},
	};
}

export type AddProductCustomOptionResult =
	| { ok: true; config: ProductAttributeConfig; value: string }
	| {
			ok: false;
			reason: "empty" | "invalid_slug" | "duplicate_global" | "duplicate_custom" | "duplicate_label";
	  };

export function previewProductCustomOptionSlug(attribute: AdminAttribute, label: string): string {
	const trimmed = label.trim();
	if (!trimmed) {
		return "";
	}
	return compactAttributeOptionValue(trimmed, attribute.unit?.trim() ?? "");
}

export function addProductCustomOption(config: ProductAttributeConfig, attribute: AdminAttribute, label: string): AddProductCustomOptionResult {
	const trimmed = label.trim();
	if (!trimmed) {
		return { ok: false, reason: "empty" };
	}

	const unit = attribute.unit?.trim() ?? "";
	const value = compactAttributeOptionValue(trimmed, unit);
	if (!value) {
		return { ok: false, reason: "invalid_slug" };
	}

	const normalizedLabel = trimmed.toLowerCase();
	const normalizedValue = value.toLowerCase();
	const globalValues = new Set(attribute.options.map((option) => option.value.toLowerCase()));
	if (globalValues.has(normalizedValue)) {
		return { ok: false, reason: "duplicate_global" };
	}

	const globalLabels = new Set(attribute.options.map((option) => option.label.trim().toLowerCase()));
	if (globalLabels.has(normalizedLabel)) {
		return { ok: false, reason: "duplicate_global" };
	}

	const existingCustom = config.attributeCustomOptions?.[attribute.slug] ?? [];
	if (existingCustom.some((option) => option.value.toLowerCase() === normalizedValue)) {
		return { ok: false, reason: "duplicate_custom" };
	}
	if (existingCustom.some((option) => option.label.trim().toLowerCase() === normalizedLabel)) {
		return { ok: false, reason: "duplicate_label" };
	}

	const nextCustom = {
		...(config.attributeCustomOptions ?? {}),
		[attribute.slug]: [...existingCustom, { value: normalizedValue, label: trimmed }],
	};
	const currentPool = normalizePoolValues(effectiveProductOptionPool(config, attribute));
	const nextPool = currentPool.includes(normalizedValue) ? currentPool : [...currentPool, normalizedValue];
	const nextSlugs = config.attributeSlugs.includes(attribute.slug) ? config.attributeSlugs : [...config.attributeSlugs, attribute.slug];

	return {
		ok: true,
		value: normalizedValue,
		config: {
			...config,
			attributeSlugs: nextSlugs,
			attributeCustomOptions: nextCustom,
			attributeOptionPool: {
				...config.attributeOptionPool,
				[attribute.slug]: nextPool,
			},
		},
	};
}

export function removeProductCustomOption(config: ProductAttributeConfig, attributeSlug: string, value: string): ProductAttributeConfig {
	const normalizedValue = value.toLowerCase();
	const existingCustom = config.attributeCustomOptions?.[attributeSlug] ?? [];
	const nextCustom = existingCustom.filter((option) => option.value.toLowerCase() !== normalizedValue);
	const nextCustomOptions = { ...(config.attributeCustomOptions ?? {}) };
	if (nextCustom.length === 0) {
		delete nextCustomOptions[attributeSlug];
	} else {
		nextCustomOptions[attributeSlug] = nextCustom;
	}

	const storedPool = config.attributeOptionPool[attributeSlug];
	const nextPool = storedPool === undefined ? undefined : normalizePoolValues(storedPool).filter((entry) => entry !== normalizedValue);

	return {
		...config,
		attributeCustomOptions: Object.keys(nextCustomOptions).length > 0 ? nextCustomOptions : undefined,
		attributeOptionPool: {
			...config.attributeOptionPool,
			...(nextPool === undefined ? {} : { [attributeSlug]: nextPool }),
		},
	};
}

export interface AttributeConfigImpactSummary {
	disabledAttributes: Array<{ slug: string; label: string; variantCount: number }>;
	removedOptions: Array<{
		attributeSlug: string;
		attributeLabel: string;
		optionLabel: string;
		variantCount: number;
	}>;
}

export function countVariantsUsingAttribute(variants: Pick<AdminVariant, "attributes">[], attributeSlug: string): number {
	let count = 0;
	for (const variant of variants) {
		const raw = variant.attributes?.[attributeSlug];
		if (raw === undefined) {
			continue;
		}
		const values = Array.isArray(raw) ? raw : [raw];
		if (values.some((entry) => typeof entry === "string" && entry.trim().length > 0)) {
			count += 1;
		}
	}
	return count;
}

function resolveImpactOptionLabel(
	attributeSlug: string,
	value: string,
	categoryAttributes: AdminAttribute[],
	config: ProductAttributeConfig,
	variants: Pick<AdminVariant, "attributes" | "attributeDisplay">[],
): string {
	const normalized = value.toLowerCase();
	for (const variant of variants) {
		const raw = variant.attributes?.[attributeSlug];
		const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
		if (values.some((entry) => typeof entry === "string" && entry.toLowerCase() === normalized) && variant.attributeDisplay?.[attributeSlug]) {
			return variant.attributeDisplay[attributeSlug];
		}
	}
	const attribute = categoryAttributes.find((row) => row.slug === attributeSlug);
	const globalOption = attribute?.options.find((option) => option.value.toLowerCase() === normalized);
	if (globalOption) {
		return formatAttributeOptionLabel(globalOption.label, attribute?.unit);
	}
	const customOption = config.attributeCustomOptions?.[attributeSlug]?.find((option) => option.value.toLowerCase() === normalized);
	if (customOption) {
		return customOption.label;
	}
	return value;
}

export function analyzeAttributeConfigImpact(
	nextConfig: ProductAttributeConfig,
	variants: Pick<AdminVariant, "attributes">[],
	categoryAttributes: AdminAttribute[],
): AttributeConfigImpactSummary {
	const disabledCounts = new Map<string, number>();
	const removedCounts = new Map<string, { attributeSlug: string; value: string; count: number }>();

	for (const variant of variants) {
		const usedSlugs = new Set<string>();
		for (const [slug, raw] of Object.entries(variant.attributes ?? {})) {
			const values = Array.isArray(raw) ? raw : [raw];
			for (const value of values) {
				if (typeof value !== "string" || !value.trim()) {
					continue;
				}
				const normalized = value.trim().toLowerCase();
				if (!nextConfig.attributeSlugs.includes(slug)) {
					if (!usedSlugs.has(slug)) {
						usedSlugs.add(slug);
						disabledCounts.set(slug, (disabledCounts.get(slug) ?? 0) + 1);
					}
					continue;
				}
				const attribute = categoryAttributes.find((row) => row.slug === slug);
				const pool = normalizePoolValues(getProductOptionPool(nextConfig, slug, attribute ? { slug: attribute.slug, options: attribute.options } : undefined));
				if (!pool.includes(normalized)) {
					const key = `${slug}:${normalized}`;
					const existing = removedCounts.get(key);
					if (existing) {
						existing.count += 1;
					} else {
						removedCounts.set(key, { attributeSlug: slug, value: normalized, count: 1 });
					}
				}
			}
		}
	}

	const disabledAttributes = [...disabledCounts.entries()]
		.map(([slug, variantCount]) => ({
			slug,
			label: categoryAttributes.find((row) => row.slug === slug)?.label ?? slug,
			variantCount,
		}))
		.sort((left, right) => left.label.localeCompare(right.label));

	const removedOptions = [...removedCounts.values()]
		.map((entry) => ({
			attributeSlug: entry.attributeSlug,
			attributeLabel: categoryAttributes.find((row) => row.slug === entry.attributeSlug)?.label ?? entry.attributeSlug,
			optionLabel: resolveImpactOptionLabel(entry.attributeSlug, entry.value, categoryAttributes, nextConfig, variants),
			variantCount: entry.count,
		}))
		.sort((left, right) => {
			const byAttribute = left.attributeLabel.localeCompare(right.attributeLabel);
			return byAttribute !== 0 ? byAttribute : left.optionLabel.localeCompare(right.optionLabel);
		});

	return { disabledAttributes, removedOptions };
}

export function hasAttributeConfigImpact(summary: AttributeConfigImpactSummary): boolean {
	return summary.disabledAttributes.length > 0 || summary.removedOptions.length > 0;
}

export function formatAttributeConfigImpactLines(summary: AttributeConfigImpactSummary): string[] {
	const lines: string[] = [];
	for (const entry of summary.disabledAttributes) {
		lines.push(`${entry.variantCount} variant${entry.variantCount === 1 ? "" : "s"} use ${entry.label}, which will be disabled on this product.`);
	}
	for (const entry of summary.removedOptions) {
		lines.push(`${entry.variantCount} variant${entry.variantCount === 1 ? "" : "s"} use ${entry.attributeLabel}: ${entry.optionLabel}, which will no longer be allowed.`);
	}
	return lines;
}

export function customOptionErrorMessage(reason: Exclude<AddProductCustomOptionResult, { ok: true }>["reason"]): string {
	switch (reason) {
		case "empty":
			return "Enter a value first.";
		case "invalid_slug":
			return "Use letters or numbers — a slug could not be generated.";
		case "duplicate_global":
			return "That matches an existing category option.";
		case "duplicate_custom":
			return "That custom option already exists.";
		case "duplicate_label":
			return "That label is already used on this product.";
	}
}
