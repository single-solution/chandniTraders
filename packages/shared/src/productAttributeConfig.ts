/**
 * Product-level attribute configuration: which category attributes apply,
 * which global options are in the pool, and optional defaults for new variants.
 */

export interface ProductCustomOption {
	value: string;
	label: string;
}

export interface ProductAttributeConfig {
	attributeSlugs: string[];
	attributeOptionPool: Record<string, string[]>;
	attributeDefaults?: Record<string, string>;
	attributeCustomOptions?: Record<string, ProductCustomOption[]>;
}

export interface CategoryAttributeRef {
	slug: string;
	options: Array<{ value: string }>;
}

export interface ProductAttributeConfigSource {
	attributeSlugs?: string[] | null;
	attributeOptionPool?: Record<string, string[]> | null;
	attributeDefaults?: Record<string, string> | null;
	attributeCustomOptions?: Record<string, ProductCustomOption[]> | null;
	variants?: Array<{ attributes?: Record<string, string | string[]> }>;
}

/** True when the product document has an explicit attribute subset. */
export function hasExplicitProductAttributeConfig(product: Pick<ProductAttributeConfigSource, "attributeSlugs">): boolean {
	return Array.isArray(product.attributeSlugs);
}

/**
 * Resolve effective config from stored product fields. Products without
 * Products without `attributeSlugs` should be normalized before deploy.
 */
export function resolveProductAttributeConfig(product: ProductAttributeConfigSource, categoryAttributes: CategoryAttributeRef[]): ProductAttributeConfig {
	if (hasExplicitProductAttributeConfig(product)) {
		const slugs = (product.attributeSlugs ?? []).filter((slug) => categoryAttributes.some((attribute) => attribute.slug === slug));
		const pool: Record<string, string[]> = {};
		const customOptions: Record<string, ProductCustomOption[]> = {};
		for (const slug of slugs) {
			const attribute = categoryAttributes.find((row) => row.slug === slug);
			if (!attribute) {
				continue;
			}
			const globalValues = new Set(attribute.options.map((option) => option.value.toLowerCase()));
			const customForSlug = (product.attributeCustomOptions?.[slug] ?? []).filter(
				(option) =>
					typeof option?.value === "string" &&
					option.value.length > 0 &&
					typeof option?.label === "string" &&
					option.label.trim().length > 0 &&
					!globalValues.has(option.value.toLowerCase()),
			);
			if (customForSlug.length > 0) {
				customOptions[slug] = customForSlug.map((option) => ({
					value: option.value,
					label: option.label.trim(),
				}));
			}
			const customValues = new Set(customForSlug.map((option) => option.value.toLowerCase()));
			const stored = product.attributeOptionPool?.[slug];
			if (Array.isArray(stored)) {
				pool[slug] = stored.filter((value) => globalValues.has(value.toLowerCase()) || customValues.has(value.toLowerCase())).map((value) => value.toLowerCase());
			} else {
				pool[slug] = [...attribute.options.map((option) => option.value), ...customForSlug.map((option) => option.value)];
			}
		}

		const defaults: Record<string, string> = {};
		if (product.attributeDefaults) {
			for (const slug of slugs) {
				const defaultValue = product.attributeDefaults[slug];
				if (typeof defaultValue !== "string" || defaultValue.length === 0) {
					continue;
				}
				const poolValues = pool[slug] ?? [];
				if (poolValues.includes(defaultValue)) {
					defaults[slug] = defaultValue;
				}
			}
		}

		return {
			attributeSlugs: slugs,
			attributeOptionPool: pool,
			...(Object.keys(customOptions).length > 0 ? { attributeCustomOptions: customOptions } : {}),
			...(Object.keys(defaults).length > 0 ? { attributeDefaults: defaults } : {}),
		};
	}

	return { attributeSlugs: [], attributeOptionPool: {} };
}

/** Global option values enabled for one attribute on this product. */
export function getProductOptionPool(config: ProductAttributeConfig, attributeSlug: string, categoryAttribute: CategoryAttributeRef | undefined): string[] {
	const stored = config.attributeOptionPool[attributeSlug];
	if (Array.isArray(stored)) {
		return stored;
	}
	return categoryAttribute?.options.map((option) => option.value) ?? [];
}

/** Whether an option value is enabled on this product (global or custom). */
export function isOptionInProductPool(config: ProductAttributeConfig, attributeSlug: string, optionValue: string): boolean {
	const pool = config.attributeOptionPool[attributeSlug];
	if (!Array.isArray(pool)) {
		return true;
	}
	const normalized = optionValue.toLowerCase();
	return pool.some((entry) => entry.toLowerCase() === normalized);
}

/** Product-only custom options for one attribute. */
export function getProductCustomOptions(config: ProductAttributeConfig, attributeSlug: string): ProductCustomOption[] {
	return config.attributeCustomOptions?.[attributeSlug] ?? [];
}

/** Whether a value is a product custom option (not a category global option). */
export function isProductCustomOptionValue(config: ProductAttributeConfig, attributeSlug: string, optionValue: string): boolean {
	return getProductCustomOptions(config, attributeSlug).some((option) => option.value === optionValue);
}

/** Whether a global (category) option value is allowed on this product. */
export function isGlobalOptionInProductPool(config: ProductAttributeConfig, attributeSlug: string, optionValue: string): boolean {
	return isOptionInProductPool(config, attributeSlug, optionValue);
}

/** Category attributes scoped to this product's configured subset. */
export function filterAttributesForProduct<T extends { slug: string }>(attributes: T[], config: ProductAttributeConfig): T[] {
	const slugSet = new Set(config.attributeSlugs);
	return attributes.filter((attribute) => slugSet.has(attribute.slug));
}

/** Resolved config + category attributes filtered to enabled slugs and option pools. */
export function resolveScopedProductAttributes<T extends CategoryAttributeRef & { options: Array<{ value: string; label: string }> }>(
	product: ProductAttributeConfigSource,
	categoryAttributes: T[],
): { config: ProductAttributeConfig; attributes: T[] } {
	const config = resolveProductAttributeConfig(product, categoryAttributes);
	const attributes = filterAttributesForProduct(categoryAttributes, config).map((attribute) => ({
		...attribute,
		options: mergeProductPoolIntoAttributeOptions(attribute, config),
	}));
	return { config, attributes };
}

/** Attribute slugs the storefront configurator may expose for one product. */
export function productConfiguratorAttributeSlugs(product: ProductAttributeConfigSource, categoryAttributes: CategoryAttributeRef[]): string[] {
	const config = resolveProductAttributeConfig(product, categoryAttributes);
	return [...config.attributeSlugs].sort((left, right) => left.localeCompare(right));
}

/** Options from a category attribute that are in the product pool. */
export function filterOptionsForProduct<T extends { value: string }>(options: T[], config: ProductAttributeConfig, attributeSlug: string): T[] {
	const pool = new Set((config.attributeOptionPool[attributeSlug] ?? []).map((value) => value.toLowerCase()));
	if (pool.size === 0) {
		return [];
	}
	return options.filter((option) => pool.has(option.value.toLowerCase()));
}

/**
 * Product pool values as pickable options — global catalog options plus
 * product-only pool entries share one shape; callers do not branch on origin.
 */
export function mergeProductPoolIntoAttributeOptions<T extends { value: string; label: string }>(attribute: { slug: string; options: T[] }, config: ProductAttributeConfig): T[] {
	const pool = getProductOptionPool(config, attribute.slug, attribute);
	const globalByValue = new Map<string, T>(attribute.options.map((option) => [option.value.toLowerCase(), option]));
	const merged: T[] = [];
	const seen = new Set<string>();

	for (const rawValue of pool) {
		const normalized = rawValue.toLowerCase();
		if (seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);

		const globalOption = globalByValue.get(normalized);
		if (globalOption) {
			merged.push(globalOption);
			continue;
		}

		const productOption = config.attributeCustomOptions?.[attribute.slug]?.find((option) => option.value.toLowerCase() === normalized);
		merged.push({
			value: productOption?.value ?? rawValue,
			label: productOption?.label ?? rawValue,
		} as T);
	}

	return merged;
}

/** Draft defaults for a new variant (global pool values only). */
export function buildVariantDefaultsFromProductConfig(config: ProductAttributeConfig): { attributes: Record<string, string>; attributeDisplay?: Record<string, string> } {
	const attributes: Record<string, string> = {};
	if (!config.attributeDefaults) {
		return { attributes };
	}
	for (const [slug, value] of Object.entries(config.attributeDefaults)) {
		if (!config.attributeSlugs.includes(slug)) {
			continue;
		}
		const pool = config.attributeOptionPool[slug] ?? [];
		if (pool.includes(value)) {
			attributes[slug] = value;
		}
	}
	return { attributes };
}
