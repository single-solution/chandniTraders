/**
 * In-memory shape for the `/products/new` form. Mirrors the AdminVariant
 * payload but every field is optional during authoring; `validate()` is
 * the canonical conversion to a clean POST body.
 */

import { formatAttributeOptionLabel, filterAttributesForProduct, mergeProductPoolIntoAttributeOptions, type ProductAttributeConfig, type SeoMeta } from "@store/shared";
import type { GalleryImage } from "@/components/shared/uploads/imageStaging";

import type { AdminAttribute, AdminBrand, AdminCategory, AdminProduct, AdminVariant } from "@/types/models";

/** Persisted attribute map: one value or several (e.g. three colors on one variant). */
export type VariantAttributeValue = string | string[];
export type VariantAttributesMap = Record<string, VariantAttributeValue>;

export interface VariantDraft {
	/** Local-only React key so the same draft can be re-rendered after edits. */
	uid: string;
	priceRupees: number;
	quantity: number;
	/** Force sold out on storefront without changing `quantity`. */
	forceOutOfStock: boolean;
	warrantyDays: number | null;
	attributes: Record<string, string>;
	attributeDisplay?: Record<string, string>;
	/** Multiple global option values for one attribute on this variant (e.g. 3 colors). */
	attributesMulti?: Record<string, string[]>;
	/** Variant-specific gallery; empty uses product-level photos on the storefront. */
	images: GalleryImage[];
}

export interface ProductDraft {
	categorySlug: string;
	brandSlug: string;
	name: string;
	seo: SeoMeta;
	variants: VariantDraft[];
	/** Ordered product gallery — single gallery per product, shared by every variant. */
	images: GalleryImage[];
}

/** Per-category data the form needs to render. Loaded via the server page. */
export interface CategorySurface {
	category: AdminCategory;
	brands: AdminBrand[];
	attributes: AdminAttribute[];
}

let variantCounter = 0;
export function newVariantUid(): string {
	variantCounter += 1;
	return `v-${Date.now().toString(36)}-${variantCounter}`;
}

export function emptyDraft(): ProductDraft {
	return {
		categorySlug: "",
		brandSlug: "",
		name: "",
		seo: {},
		variants: [],
		images: [],
	};
}

export function emptyVariantDraft(): VariantDraft {
	return {
		uid: newVariantUid(),
		priceRupees: 0,
		quantity: 1,
		forceOutOfStock: false,
		warrantyDays: null,
		attributes: {},
		attributeDisplay: {},
		attributesMulti: {},
		images: [],
	};
}

/** Short label for pickers (e.g. "copy images from" sibling variant). */
export function describeVariantDraftLabel(draft: VariantDraft, attributes: AdminAttribute[]): string {
	const merged = mergeVariantDraftAttributes(draft);
	const parts: string[] = [];
	for (const attribute of attributes) {
		const raw = merged[attribute.slug];
		if (!raw) {
			continue;
		}
		const values = Array.isArray(raw) ? raw : [raw];
		for (const value of values) {
			if (!value) {
				continue;
			}
			const option = attribute.options.find((row) => row.value === value);
			const label = draft.attributeDisplay?.[attribute.slug] ?? (option ? formatAttributeOptionLabel(option.label, attribute.unit) : String(value));
			parts.push(label);
		}
	}
	if (parts.length > 0) {
		return parts.slice(0, 4).join(" · ");
	}
	return "Unconfigured variant";
}

export function mergeVariantDraftAttributes(draft: VariantDraft): VariantAttributesMap {
	const merged: VariantAttributesMap = { ...draft.attributes };
	for (const [slug, values] of Object.entries(draft.attributesMulti ?? {})) {
		if (values.length > 0) {
			merged[slug] = values.length === 1 ? values[0] : [...values];
		}
	}
	return merged;
}

/** Selected option values for one attribute (single + multi-select). */
export function attributeValuesOnDraft(draft: VariantDraft, slug: string): string[] {
	const multi = draft.attributesMulti?.[slug];
	if (multi && multi.length > 0) {
		return multi;
	}
	const single = draft.attributes[slug];
	return single ? [single] : [];
}

export function adminVariantToDraft(variant: AdminVariant): VariantDraft {
	const attributes: Record<string, string> = {};
	const attributesMulti: Record<string, string[]> = {};

	for (const [slug, raw] of Object.entries(variant.attributes ?? {})) {
		if (Array.isArray(raw)) {
			if (raw.length === 1) {
				attributes[slug] = raw[0];
			} else if (raw.length > 1) {
				attributesMulti[slug] = [...raw];
			}
			continue;
		}
		if (typeof raw === "string" && raw.length > 0) {
			attributes[slug] = raw;
		}
	}

	return {
		uid: variant.id,
		priceRupees: variant.priceRupees,
		quantity: variant.quantity,
		forceOutOfStock: variant.forceOutOfStock ?? false,
		warrantyDays: variant.warrantyDays ?? null,
		attributes,
		attributesMulti,
		attributeDisplay: variant.attributeDisplay ? { ...variant.attributeDisplay } : {},
		images: (variant.images ?? []) as GalleryImage[],
	};
}

export interface ProductValidationError {
	/** Path like "name", "variants.0.priceRupees", "variants.1.attributes.storage". */
	path: string;
	message: string;
}

export interface ProductValidationOk {
	ok: true;
	payload: {
		name: string;
		categorySlug: string;
		brandSlug: string;
		variants: Array<{
			priceRupees: number;
			quantity: number;
			forceOutOfStock: boolean;
			warrantyDays?: number;
			attributes: VariantAttributesMap;
			attributeDisplay?: Record<string, string>;
			images: GalleryImage[];
		}>;
		seo?: SeoMeta;
	};
}

export interface ProductValidationFail {
	ok: false;
	errors: ProductValidationError[];
}

export interface ShellValidationOk {
	ok: true;
	payload: {
		name: string;
		categorySlug: string;
		brandSlug: string;
	};
}

export function validateShellDraft(draft: Pick<ProductDraft, "categorySlug" | "brandSlug" | "name">): ShellValidationOk | ProductValidationFail {
	const errors: ProductValidationError[] = [];

	if (!draft.categorySlug) {
		errors.push({ path: "categorySlug", message: "Pick a category." });
	}
	if (!draft.brandSlug) {
		errors.push({ path: "brandSlug", message: "Pick a brand." });
	}
	const name = draft.name.trim();
	if (name.length < 2) {
		errors.push({ path: "name", message: "Product name is required." });
	} else if (name.length > 120) {
		errors.push({ path: "name", message: "Product name is too long (max 120)." });
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		payload: {
			name,
			categorySlug: draft.categorySlug,
			brandSlug: draft.brandSlug,
		},
	};
}

function collectVariantErrors(
	variants: VariantDraft[],
	surface: CategorySurface,
	brandSlug: string,
	pathForIndex: (index: number) => string,
	productConfig: ProductAttributeConfig,
): ProductValidationError[] {
	const errors: ProductValidationError[] = [];
	const requiredAttributes = filterAttributesForProduct(surface.attributes, productConfig).map((attribute) => ({
		...attribute,
		options: mergeProductPoolIntoAttributeOptions(attribute, productConfig),
	}));

	variants.forEach((variant, index) => {
		const prefix = pathForIndex(index);
		if (!Number.isInteger(variant.priceRupees) || variant.priceRupees <= 0) {
			errors.push({
				path: `${prefix}.priceRupees`,
				message: "Enter a price.",
			});
		}
		if (!Number.isInteger(variant.quantity) || variant.quantity < 0) {
			errors.push({
				path: `${prefix}.quantity`,
				message: "Quantity must be a non-negative whole number.",
			});
		}
		if (variant.warrantyDays !== null && (!Number.isInteger(variant.warrantyDays) || variant.warrantyDays < 0)) {
			errors.push({
				path: `${prefix}.warrantyDays`,
				message: "Warranty days must be a non-negative whole number.",
			});
		}

		for (const attr of requiredAttributes) {
			const selectedValues = attributeValuesOnDraft(variant, attr.slug);
			if (selectedValues.length === 0) {
				errors.push({
					path: `${prefix}.attributes.${attr.slug}`,
					message: `Select a ${attr.label.toLowerCase()}.`,
				});
				continue;
			}

			for (const value of selectedValues) {
				const inPool = attr.options.some((option) => option.value.toLowerCase() === value.toLowerCase());
				if (!inPool) {
					errors.push({
						path: `${prefix}.attributes.${attr.slug}`,
						message: `${value} is not in this product's option pool for ${attr.label.toLowerCase()}.`,
					});
				}
			}
		}
	});

	return errors;
}

/** Product gallery is optional when variants carry their own photos. */
export function collectProductImageErrors(_images: GalleryImage[]): ProductValidationError[] {
	return [];
}

export function validateVariantDrafts(
	variants: VariantDraft[],
	surface: CategorySurface,
	brandSlug: string,
	productConfig: ProductAttributeConfig,
	pathForIndex: (index: number) => string = (index) => `variants.${index}`,
): ProductValidationOk | ProductValidationFail {
	const errors = collectVariantErrors(variants, surface, brandSlug, pathForIndex, productConfig);

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		payload: {
			name: "",
			categorySlug: surface.category.slug,
			brandSlug,
			variants: variants.map((variant) => {
				const out: ProductValidationOk["payload"]["variants"][number] = {
					priceRupees: variant.priceRupees,
					quantity: variant.quantity,
					forceOutOfStock: variant.forceOutOfStock,
					attributes: mergeVariantDraftAttributes(variant),
					images: [...variant.images],
				};
				if (variant.warrantyDays !== null) {
					out.warrantyDays = variant.warrantyDays;
				}
				if (variant.attributeDisplay && Object.keys(variant.attributeDisplay).length > 0) {
					out.attributeDisplay = { ...variant.attributeDisplay };
				}
				return out;
			}),
		},
	};
}

export function validateDraft(draft: ProductDraft, surface: CategorySurface | null, productConfig?: ProductAttributeConfig): ProductValidationOk | ProductValidationFail {
	const shell = validateShellDraft(draft);
	if (!shell.ok) {
		return shell;
	}

	if (!surface) {
		return { ok: false, errors: [{ path: "categorySlug", message: "Pick a category." }] };
	}

	if (draft.variants.length === 0) {
		return {
			ok: false,
			errors: [{ path: "variants", message: "Add at least one variant." }],
		};
	}

	const resolvedConfig =
		productConfig ??
		({
			attributeSlugs: surface.attributes.map((attribute) => attribute.slug),
			attributeOptionPool: Object.fromEntries(surface.attributes.map((attribute) => [attribute.slug, attribute.options.map((option) => option.value)])),
		} satisfies ProductAttributeConfig);

	const variantErrors = collectVariantErrors(draft.variants, surface, draft.brandSlug, (index) => `variants.${index}`, resolvedConfig);
	const imageErrors = collectProductImageErrors(draft.images);
	const allErrors = [...variantErrors, ...imageErrors];

	if (allErrors.length > 0) {
		return { ok: false, errors: allErrors };
	}

	const seoPayload = draft.seo ?? {};
	const hasSeo = Object.values(seoPayload).some((value) => value === true || (typeof value === "string" && value.length > 0));

	return {
		ok: true,
		payload: {
			...shell.payload,
			...(hasSeo ? { seo: seoPayload } : {}),
			variants: draft.variants.map((variant) => {
				const out: ProductValidationOk["payload"]["variants"][number] = {
					priceRupees: variant.priceRupees,
					quantity: variant.quantity,
					forceOutOfStock: variant.forceOutOfStock,
					attributes: mergeVariantDraftAttributes(variant),
					images: [...variant.images],
				};
				if (variant.warrantyDays !== null) {
					out.warrantyDays = variant.warrantyDays;
				}
				if (variant.attributeDisplay && Object.keys(variant.attributeDisplay).length > 0) {
					out.attributeDisplay = { ...variant.attributeDisplay };
				}
				return out;
			}),
		},
	};
}

export function errorsByPath(errors: ProductValidationError[]) {
	const map = new Map<string, string>();
	for (const error of errors) {
		if (!map.has(error.path)) {
			map.set(error.path, error.message);
		}
	}
	return map;
}

/** Whether any validation error belongs to one variant draft path prefix. */
export function variantHasErrors(errorByPath: Map<string, string>, pathPrefix: string): boolean {
	for (const path of errorByPath.keys()) {
		if (path === pathPrefix || path.startsWith(`${pathPrefix}.`)) {
			return true;
		}
	}
	return false;
}

export function variantErrorCount(errorByPath: Map<string, string>, pathPrefix: string): number {
	let count = 0;
	for (const path of errorByPath.keys()) {
		if (path === pathPrefix || path.startsWith(`${pathPrefix}.`)) {
			count += 1;
		}
	}
	return count;
}
