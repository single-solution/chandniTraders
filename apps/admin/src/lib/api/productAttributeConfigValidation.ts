import { isGlobalOptionInProductPool, type ProductAttributeConfig, type ProductCustomOption } from "@store/shared";

import { Attribute, connectDB } from "@store/db";

type ValidationResult = { ok: true; value: ProductAttributeConfig } | { ok: false; error: string };

function asStringArray(raw: unknown): string[] | null {
	if (!Array.isArray(raw)) {
		return null;
	}

	const values = raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

	return values.map((entry) => entry.trim().toLowerCase());
}

function parseCustomOptions(raw: unknown): Record<string, ProductCustomOption[]> | null {
	if (raw === undefined) {
		return null;
	}

	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return null;
	}

	const result: Record<string, ProductCustomOption[]> = {};

	for (const [slug, rawOptions] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(rawOptions)) {
			return null;
		}

		const options: ProductCustomOption[] = [];

		for (const entry of rawOptions) {
			if (
				typeof entry !== "object" ||
				entry === null ||
				Array.isArray(entry) ||
				typeof (entry as { value?: unknown }).value !== "string" ||
				typeof (entry as { label?: unknown }).label !== "string"
			) {
				return null;
			}

			const value = (entry as { value: string }).value.trim().toLowerCase();

			const label = (entry as { label: string }).label.trim();

			if (!value || !label) {
				continue;
			}

			options.push({ value, label });
		}

		if (options.length > 0) {
			result[slug] = options;
		}
	}

	return result;
}

/**

 * Validate and normalize product attribute config from an API payload.

 * Passing `attributeSlugs: []` explicitly disables all attributes on the product.

 */

export async function validateProductAttributeConfig(
	input: {
		attributeSlugs?: unknown;

		attributeOptionPool?: unknown;

		attributeCustomOptions?: unknown;

		attributeDefaults?: unknown;
	},

	categorySlug: string,

	options: { strictPools?: boolean } = {},
): Promise<ValidationResult> {
	if (input.attributeSlugs === undefined && input.attributeOptionPool === undefined && input.attributeCustomOptions === undefined && input.attributeDefaults === undefined) {
		return { ok: false, error: "No attribute config fields provided." };
	}

	await connectDB();

	const defs = await Attribute.find({ categorySlug, isActive: true })

		.select("slug options.value")

		.lean<Array<{ slug: string; options: Array<{ value: string }> }>>()

		.exec();

	const defsBySlug = new Map(defs.map((row) => [row.slug, row]));

	let attributeSlugs: string[] | undefined;

	if (input.attributeSlugs !== undefined) {
		const parsed = asStringArray(input.attributeSlugs);

		if (parsed === null) {
			return { ok: false, error: "attributeSlugs must be an array of strings." };
		}

		for (const slug of parsed) {
			if (!defsBySlug.has(slug)) {
				return {
					ok: false,

					error: `Unknown attribute '${slug}' for category '${categorySlug}'.`,
				};
			}
		}

		attributeSlugs = parsed;
	}

	const parsedCustomOptions = parseCustomOptions(input.attributeCustomOptions);

	if (input.attributeCustomOptions !== undefined && parsedCustomOptions === null) {
		return { ok: false, error: "attributeCustomOptions must be an object map of option arrays." };
	}

	const attributeCustomOptions: Record<string, ProductCustomOption[]> = {};

	if (parsedCustomOptions) {
		for (const [slug, options] of Object.entries(parsedCustomOptions)) {
			const def = defsBySlug.get(slug);

			if (!def) {
				return {
					ok: false,

					error: `Unknown attribute '${slug}' in attributeCustomOptions.`,
				};
			}

			const globalValues = new Set(def.options.map((option) => option.value));

			for (const option of options) {
				if (globalValues.has(option.value)) {
					return {
						ok: false,

						error: `Custom option '${option.value}' conflicts with a global option for '${slug}'.`,
					};
				}
			}

			attributeCustomOptions[slug] = options;
		}
	}

	const attributeOptionPool: Record<string, string[]> = {};

	if (input.attributeOptionPool !== undefined) {
		if (input.attributeOptionPool === null || typeof input.attributeOptionPool !== "object" || Array.isArray(input.attributeOptionPool)) {
			return { ok: false, error: "attributeOptionPool must be an object map." };
		}

		for (const [rawSlug, rawValues] of Object.entries(input.attributeOptionPool as Record<string, unknown>)) {
			const slug = rawSlug.trim().toLowerCase();

			const def = defsBySlug.get(slug);

			if (!def) {
				return {
					ok: false,

					error: `Unknown attribute '${slug}' in attributeOptionPool.`,
				};
			}

			if (!Array.isArray(rawValues)) {
				return {
					ok: false,

					error: `attributeOptionPool.${slug} must be an array.`,
				};
			}

			const globalValues = new Set(def.options.map((option) => option.value.toLowerCase()));

			const customValues = new Set((attributeCustomOptions[slug] ?? []).map((option) => option.value.toLowerCase()));

			const values = rawValues

				.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)

				.map((entry) => entry.trim().toLowerCase());

			for (const value of values) {
				if (!globalValues.has(value) && !customValues.has(value)) {
					return {
						ok: false,

						error: `Option '${value}' is not a global or custom option for '${slug}'.`,
					};
				}
			}

			attributeOptionPool[slug] = values;
		}
	}

	const attributeDefaults: Record<string, string> = {};

	if (input.attributeDefaults !== undefined) {
		if (input.attributeDefaults === null || typeof input.attributeDefaults !== "object" || Array.isArray(input.attributeDefaults)) {
			return { ok: false, error: "attributeDefaults must be an object map." };
		}

		for (const [slug, rawValue] of Object.entries(input.attributeDefaults as Record<string, unknown>)) {
			if (typeof rawValue !== "string" || rawValue.length === 0) {
				return {
					ok: false,

					error: `attributeDefaults.${slug} must be a non-empty string.`,
				};
			}

			const def = defsBySlug.get(slug);

			if (!def) {
				return {
					ok: false,

					error: `Unknown attribute '${slug}' in attributeDefaults.`,
				};
			}

			if (!def.options.some((option) => option.value === rawValue)) {
				return {
					ok: false,

					error: `Default '${rawValue}' is not a global option for '${slug}'.`,
				};
			}

			attributeDefaults[slug] = rawValue;
		}
	}

	const resolvedSlugs = attributeSlugs ?? [...new Set([...Object.keys(attributeOptionPool), ...Object.keys(attributeCustomOptions), ...Object.keys(attributeDefaults)])];

	if (attributeSlugs !== undefined) {
		for (const slug of Object.keys(attributeOptionPool)) {
			if (!attributeSlugs.includes(slug)) {
				return {
					ok: false,

					error: `attributeOptionPool includes '${slug}' which is not in attributeSlugs.`,
				};
			}
		}

		for (const slug of Object.keys(attributeCustomOptions)) {
			if (!attributeSlugs.includes(slug)) {
				return {
					ok: false,

					error: `attributeCustomOptions includes '${slug}' which is not in attributeSlugs.`,
				};
			}
		}

		for (const slug of Object.keys(attributeDefaults)) {
			if (!attributeSlugs.includes(slug)) {
				return {
					ok: false,

					error: `attributeDefaults includes '${slug}' which is not in attributeSlugs.`,
				};
			}
		}
	}

	const config: ProductAttributeConfig = {
		attributeSlugs: resolvedSlugs,

		attributeOptionPool: {},
	};

	const useStrictPools = options.strictPools === true && input.attributeSlugs !== undefined && input.attributeOptionPool !== undefined;

	for (const slug of resolvedSlugs) {
		const def = defsBySlug.get(slug);

		if (!def) {
			continue;
		}

		if (useStrictPools) {
			config.attributeOptionPool[slug] = attributeOptionPool[slug] ?? [];

			continue;
		}

		const customValues = (attributeCustomOptions[slug] ?? []).map((option) => option.value);

		config.attributeOptionPool[slug] = Object.prototype.hasOwnProperty.call(attributeOptionPool, slug)
			? attributeOptionPool[slug]
			: [...def.options.map((option) => option.value), ...customValues];
	}

	if (Object.keys(attributeCustomOptions).length > 0 || input.attributeCustomOptions !== undefined) {
		config.attributeCustomOptions = attributeCustomOptions;
	}

	for (const [slug, value] of Object.entries(attributeDefaults)) {
		if (!isGlobalOptionInProductPool(config, slug, value)) {
			return {
				ok: false,

				error: `Default '${value}' is not in the option pool for '${slug}'.`,
			};
		}
	}

	if (Object.keys(attributeDefaults).length > 0) {
		config.attributeDefaults = attributeDefaults;
	}

	return { ok: true, value: config };
}
