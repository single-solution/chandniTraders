import { FIELD_LIMITS, isGlobalOptionInProductPool, resolveProductAttributeConfig, WARRANTY_DAYS_PER_MONTH, type ProductAttributeConfig } from "@store/shared";
import { Attribute, connectDB, Product } from "@store/db";

import { validateProductImages } from "./productImagesValidation";

/**
 * Hard upper bound on any rupee field. Even the most expensive items
 * we'd realistically stock are well under this ceiling; anything past
 * 100M is definitionally an admin typo or an attempted overflow attack.
 */
const MAX_RUPEE_AMOUNT = 100_000_000;

/** Default warranty when the admin didn't specify (6 months). */
const DEFAULT_WARRANTY_DAYS = 6 * WARRANTY_DAYS_PER_MONTH;
/** Hard upper bound — 5 years in days. */
const MAX_WARRANTY_DAYS = 60 * WARRANTY_DAYS_PER_MONTH;
/** Hard upper bound on variant quantity. Anything past 100k is a typo. */
const MAX_QUANTITY = 100_000;

export interface VariantInput {
	priceRupees?: unknown;
	quantity?: unknown;
	forceOutOfStock?: unknown;
	warrantyDays?: unknown;
	images?: unknown;
	attributes?: unknown;
	attributeDisplay?: unknown;
}

type VariantValidationResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

interface ValidationContext {
	/** Required so attribute validation can scope by category. */
	categorySlug: string;
	/** Product brand — used for brand-gated attribute visibility. */
	brandSlug?: string;
	/** Resolved product attribute subset + option pools. */
	productConfig?: ProductAttributeConfig;
}

/**
 * Coerce + validate a variant payload against the per-category Attribute
 * collection. Asynchronous because attribute lookups touch MongoDB; callers
 * are already inside an `await connectDB()` scope on every authoring path.
 *
 * Accepts partial input — caller decides which fields are required by
 * passing `requireAll`.
 */
export async function validateVariant(input: VariantInput, requireAll: boolean, context: ValidationContext): Promise<VariantValidationResult> {
	await connectDB();
	const value: Record<string, unknown> = {};

	if (input.priceRupees !== undefined || requireAll) {
		const price = Number(input.priceRupees);
		if (!Number.isFinite(price) || price < 0 || price > MAX_RUPEE_AMOUNT) {
			return { ok: false, error: "Price must be a non-negative number." };
		}
		value.priceRupees = price;
	}

	if (input.quantity !== undefined || requireAll) {
		const quantity = Number(input.quantity ?? 0);
		if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
			return {
				ok: false,
				error: `Quantity must be a non-negative integer ≤ ${MAX_QUANTITY}.`,
			};
		}
		value.quantity = quantity;
	}

	if (input.forceOutOfStock !== undefined) {
		if (typeof input.forceOutOfStock !== "boolean") {
			return { ok: false, error: "Force out of stock must be true or false." };
		}
		value.forceOutOfStock = input.forceOutOfStock;
	} else if (requireAll) {
		value.forceOutOfStock = false;
	}

	if (input.warrantyDays !== undefined || requireAll) {
		const days = Number(input.warrantyDays ?? DEFAULT_WARRANTY_DAYS);
		if (!Number.isFinite(days) || days < 0 || days > MAX_WARRANTY_DAYS) {
			return {
				ok: false,
				error: `Warranty must be 0–${MAX_WARRANTY_DAYS} days.`,
			};
		}
		if (!Number.isInteger(days)) {
			return {
				ok: false,
				error: "Warranty days must be a whole number.",
			};
		}
		value.warrantyDays = days;
	} else if (requireAll) {
		value.warrantyDays = DEFAULT_WARRANTY_DAYS;
	}

	if (input.images !== undefined || requireAll) {
		const imagesResult = validateProductImages(input.images ?? []);
		if (!imagesResult.ok) {
			return imagesResult;
		}
		value.images = imagesResult.value;
	}

	// Dynamic per-category attribute map — values must be in the product option pool.
	if (input.attributes !== undefined || requireAll) {
		const attributes = (input.attributes ?? {}) as unknown;
		if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) {
			return { ok: false, error: "Attributes must be an object map." };
		}
		const map = attributes as Record<string, unknown>;

		if (input.attributeDisplay !== undefined) {
			const rawDisplay = input.attributeDisplay;
			if (rawDisplay !== null && (typeof rawDisplay !== "object" || Array.isArray(rawDisplay))) {
				return { ok: false, error: "attributeDisplay must be an object map." };
			}
		}

		const defs = await Attribute.find({
			categorySlug: context.categorySlug,
			isActive: true,
		})
			.lean()
			.exec();
		const defsBySlug = new Map(defs.map((definition) => [definition.slug, definition]));

		const validated: Record<string, string | string[]> = {};
		const productSlugs = context.productConfig?.attributeSlugs;

		for (const [slug, raw] of Object.entries(map)) {
			const def = defsBySlug.get(slug);
			if (!def) {
				return {
					ok: false,
					error: `Unknown attribute '${slug}' for category '${context.categorySlug}'.`,
				};
			}
			if (productSlugs && !productSlugs.includes(slug)) {
				return {
					ok: false,
					error: `Attribute '${slug}' is not enabled for this product.`,
				};
			}

			const values: string[] = Array.isArray(raw)
				? raw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
				: typeof raw === "string" && raw.length > 0
					? [raw]
					: [];

			if (values.length === 0) {
				return {
					ok: false,
					error: `Attribute '${slug}' must have at least one value.`,
				};
			}

			const optionValues = new Set(def.options.map((option) => option.value));
			const normalizedSlug = slug.slice(0, FIELD_LIMITS.shortLabel);

			for (const optionValue of values) {
				const inGlobalCatalog = optionValues.has(optionValue);
				const inProductPool = context.productConfig && isGlobalOptionInProductPool(context.productConfig, slug, optionValue);

				if (!inGlobalCatalog) {
					if (!inProductPool) {
						return {
							ok: false,
							error: `Unknown option '${optionValue}' for attribute '${slug}'.`,
						};
					}
					continue;
				}

				if (context.productConfig && !inProductPool) {
					return {
						ok: false,
						error: `Option '${optionValue}' is not enabled for '${slug}' on this product.`,
					};
				}
			}

			validated[normalizedSlug] = values.length === 1 ? values[0] : values.map((optionValue) => optionValue);
		}

		if (requireAll && context.productConfig) {
			for (const slug of context.productConfig.attributeSlugs) {
				const def = defsBySlug.get(slug);
				if (!def) {
					continue;
				}
				const existing = validated[slug.slice(0, FIELD_LIMITS.shortLabel)];
				if (!existing || (Array.isArray(existing) && existing.length === 0)) {
					return {
						ok: false,
						error: `Attribute '${slug}' is required for this product.`,
					};
				}
			}
		}

		value.attributes = validated;
		if (input.attributeDisplay !== undefined) {
			value.attributeDisplay = {};
		}
	}

	return { ok: true, value };
}

export async function validateVariantsBatch(
	variants: VariantInput[],
	requireAll: boolean,
	context: ValidationContext,
): Promise<{ ok: true; values: Record<string, unknown>[] } | { ok: false; error: string }> {
	const results = await Promise.all(variants.map((raw, index) => validateVariant(raw, requireAll, context).then((result) => ({ index, result }))));
	const failed = results.find((entry) => !entry.result.ok);
	if (failed && !failed.result.ok) {
		return { ok: false, error: `Variant ${failed.index + 1}: ${failed.result.error}` };
	}
	return {
		ok: true,
		values: results.map((entry) => {
			if (!entry.result.ok) {
				throw new Error("unreachable");
			}
			return entry.result.value;
		}),
	};
}

/** Load category + resolved product attribute config for variant validation. */
export async function loadVariantValidationContext(productId: string): Promise<{
	categorySlug: string;
	brandSlug: string;
	productConfig: ProductAttributeConfig;
} | null> {
	await connectDB();
	const product = await Product.findById(productId)
		.select("categorySlug brandSlug attributeSlugs attributeOptionPool attributeCustomOptions attributeDefaults variants.attributes")
		.lean<{
			categorySlug: string;
			brandSlug: string;
			attributeSlugs?: string[];
			attributeOptionPool?: Record<string, string[]>;
			attributeCustomOptions?: Record<string, Array<{ value: string; label: string }>>;
			attributeDefaults?: Record<string, string>;
			variants?: Array<{ attributes?: Record<string, string | string[]> }>;
		}>();
	if (!product) {
		return null;
	}

	const defs = await Attribute.find({
		categorySlug: product.categorySlug,
		isActive: true,
	})
		.select("slug options.value")
		.lean<Array<{ slug: string; options: Array<{ value: string }> }>>()
		.exec();

	return {
		categorySlug: product.categorySlug,
		brandSlug: product.brandSlug,
		productConfig: resolveProductAttributeConfig(product, defs),
	};
}
