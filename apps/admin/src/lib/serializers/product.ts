import type { Types } from "mongoose";
import type { StoredImage, SeoMeta } from "@store/shared";
import type { ProductAttributes, VariantAttributes, WithTimestamps } from "@store/db";
import type { BrandLean } from "@/lib/serializers/brand";
import type { AdminProduct, AdminProductSummary, AdminVariant } from "@/types/models";
import { asArray, asNumber, asString, calculateProductSeoScore, coerceStoredImage, objectIdString, resolveWarrantyDays, toIsoDate } from "@store/shared";

export type ProductLean = WithTimestamps<ProductAttributes> & {
	_id: Types.ObjectId;
};

/** Coerce a stored-image array off a lean document, dropping anything that
 *  doesn't survive `coerceStoredImage`. */
function asStoredImageArray(raw: unknown): StoredImage[] {
	return asArray<unknown>(raw)
		.map(coerceStoredImage)
		.filter((image): image is StoredImage => image !== null);
}

function toVariantResponse(variant: VariantAttributes): AdminVariant {
	return {
		id: objectIdString(variant._id),
		priceRupees: asNumber(variant.priceRupees),
		quantity: variant.quantity ?? 0,
		forceOutOfStock: variant.forceOutOfStock === true,
		warrantyDays: resolveWarrantyDays(variant),
		images: asStoredImageArray(variant.images),
		attributes: variant.attributes ?? {},
		attributeDisplay: variant.attributeDisplay,
	};
}

/**
 * Resolve the embedded brand reference. The new product shape carries
 * `brandSlug: string`; an optional `BrandLean` lookup is used to fill in
 * `name`. If the brand has been deleted, `name` falls back to the slug
 * so the admin grid still renders a readable label.
 */
function toBrandRef(product: ProductLean, brand: BrandLean | undefined) {
	return {
		slug: brand?.slug ?? asString(product?.brandSlug),
		name: brand?.name ?? asString(product?.brandSlug),
	};
}

export function brandLookupKey(categorySlug: string, brandSlug: string): string {
	return `${categorySlug}:${brandSlug}`;
}

/** Variant-derived rollups (count, in-stock count, starting price, hero). */
function computeVariantRollup(product: ProductLean, images: StoredImage[]) {
	const variants = asArray<VariantAttributes>(product?.variants);
	const variantCount = variants.length;
	const inStockCount = variants.filter((variant) => variant.forceOutOfStock !== true && (variant.quantity ?? 0) > 0).length;
	const prices = variants.map((variant) => asNumber(variant?.priceRupees)).filter((price) => price > 0);
	const minPriceRupees = prices.length > 0 ? Math.min(...prices) : undefined;
	const maxPriceRupees = prices.length > 0 ? Math.max(...prices) : undefined;
	const totalStockQuantity = variants.reduce((acc, variant) => acc + (variant?.quantity ?? 0), 0);
	const heroImage = images[0] ?? null;
	return { variantCount, inStockCount, minPriceRupees, maxPriceRupees, totalStockQuantity, heroImage };
}

export function summariseProduct(product: ProductLean, brandsByCategoryAndSlug: Map<string, BrandLean>, storeName: string): AdminProductSummary {
	const categorySlug = asString(product?.categorySlug);
	const brand = brandsByCategoryAndSlug.get(brandLookupKey(categorySlug, asString(product?.brandSlug)));
	const images = asStoredImageArray(product?.images);
	const rollup = computeVariantRollup(product, images);

	const seoScore = product?.seo?.score ?? calculateProductSeoScore(asString(product?.name), brand?.name || "", product?.seo, rollup.heroImage !== null, storeName);

	return {
		id: objectIdString(product?._id),
		slug: asString(product?.slug),
		name: asString(product?.name),
		categorySlug,
		brand: toBrandRef(product, brand),
		isFeatured: product?.isFeatured ?? false,
		isActive: product?.isActive ?? true,
		isArchived: product?.isArchived ?? false,
		...rollup,
		hasImages: images.length > 0,
		seo: product?.seo,
		seoScore,
		createdAt: toIsoDate(product?.createdAt),
		updatedAt: toIsoDate(product?.updatedAt),
	};
}

function asStringRecord(raw: unknown): Record<string, string> | undefined {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return undefined;
	}
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof value === "string" && value.length > 0) {
			result[key] = value;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function asStringArrayRecord(raw: unknown): Record<string, string[]> | undefined {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return undefined;
	}
	const result: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(value)) {
			continue;
		}
		const strings = value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
		result[key] = strings;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function asCustomOptionsRecord(raw: unknown): Record<string, Array<{ value: string; label: string }>> | undefined {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return undefined;
	}
	const result: Record<string, Array<{ value: string; label: string }>> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(value)) {
			continue;
		}
		const options = value
			.map((entry) => {
				if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
					return null;
				}
				const optionValue = (entry as { value?: unknown }).value;
				const optionLabel = (entry as { label?: unknown }).label;
				if (typeof optionValue !== "string" || typeof optionLabel !== "string") {
					return null;
				}
				if (!optionValue || !optionLabel.trim()) {
					return null;
				}
				return { value: optionValue, label: optionLabel.trim() };
			})
			.filter((entry): entry is { value: string; label: string } => entry !== null);
		if (options.length > 0) {
			result[key] = options;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function toProductAttributeConfigFields(product: ProductLean) {
	const attributeSlugs = Array.isArray(product?.attributeSlugs) ? product.attributeSlugs.filter((slug): slug is string => typeof slug === "string" && slug.length > 0) : undefined;

	const attributeCustomOptions = asCustomOptionsRecord(product?.attributeCustomOptions);
	const attributeOptionPool = asStringArrayRecord(product?.attributeOptionPool);

	return {
		...(attributeSlugs !== undefined ? { attributeSlugs } : {}),
		...(attributeSlugs !== undefined ? { attributeOptionPool: attributeOptionPool ?? {} } : attributeOptionPool !== undefined ? { attributeOptionPool } : {}),
		...(attributeSlugs !== undefined ? { attributeCustomOptions: attributeCustomOptions ?? {} } : attributeCustomOptions ? { attributeCustomOptions } : {}),
		attributeDefaults: asStringRecord(product?.attributeDefaults),
	};
}

export function toProductResponse(product: ProductLean, brand: BrandLean | undefined): AdminProduct {
	const images = asStoredImageArray(product?.images);
	const rollup = computeVariantRollup(product, images);

	return {
		id: objectIdString(product?._id),
		slug: asString(product?.slug),
		name: asString(product?.name),
		categorySlug: asString(product?.categorySlug),
		brand: toBrandRef(product, brand),
		isFeatured: product?.isFeatured ?? false,
		isActive: product?.isActive ?? true,
		isArchived: product?.isArchived ?? false,
		...rollup,
		hasImages: images.length > 0,
		images,
		variants: asArray<VariantAttributes>(product?.variants).map(toVariantResponse),
		...toProductAttributeConfigFields(product),
		seo: product?.seo,
		createdAt: toIsoDate(product?.createdAt),
		updatedAt: toIsoDate(product?.updatedAt),
	};
}
