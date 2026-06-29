/**
 * DB → public storefront shape converters.
 *
 * Every component in the web app imports the public catalog types
 * (`Brand`, `Product`, `Variant`, `Offer`)
 * from `@store/shared`. This file is the bridge — query helpers in this
 * folder return those shapes and only those shapes.
 *
 * Security/UX guarantees enforced here:
 *   - Admin-only flags (`isArchived`, `isActive`) are stripped — the
 *     query layer already filters them out, this file never re-emits.
 *   - IDs are stringified Mongo ObjectIds; slugs are the public URL key.
 *   - The output is JSON-safe (no Date / ObjectId in the response).
 */

import type { Types } from "mongoose";

import type { AttributeAttributes, BrandAttributes, OfferAttributes, ProductAttributes, VariantAttributes, WithTimestamps } from "@store/db";
import type { AttributeDescriptor, Brand, Offer, Product, Variant, StoredImage } from "@store/shared";
import type { StructuredContent } from "@store/shared";
import { resolveWarrantyDays } from "@store/shared";
import {
	asArray,
	asNumber,
	asString,
	catalogBrandLogoUrl,
	isCanonicalBrandSlug,
	coerceStoredImage,
	hasStructuredContent,
	isStoredImage,
	normalizeStructuredContent,
	normalizeAttributeCardPosition,
	objectIdString,
	parseAttributeVisibility,
	sortAttributeOptions,
	toIsoDate,
} from "@store/shared";

import { resolveIconNode } from "@/lib/icons/iconNode";

/** Mongoose lean shape for a brand. */
export type BrandLean = WithTimestamps<BrandAttributes> & {
	_id: Types.ObjectId;
};
/** Mongoose lean shape for a product. */
export type ProductLean = WithTimestamps<ProductAttributes> & {
	_id: Types.ObjectId;
};
/** Mongoose lean shape for an offer. */
export type OfferLean = WithTimestamps<OfferAttributes> & {
	_id: Types.ObjectId;
};
export type AttributeLean = WithTimestamps<AttributeAttributes> & {
	_id: Types.ObjectId;
};

/**
 * Brand → public Brand. `productCount` is supplied by the caller (we
 * compute it via a single aggregation per page render, not per-brand).
 */
export function toBrand(brand: BrandLean, productCount: number): Brand {
	const slug = asString(brand.slug);
	return {
		slug,
		name: asString(brand.name),
		logoUrl: catalogBrandLogoUrl(slug),
		productCount: asNumber(productCount),
		seo: brand.seo,
	};
}

export function toAttribute(attribute: AttributeLean): AttributeDescriptor {
	return {
		categorySlug: asString(attribute.categorySlug),
		slug: asString(attribute.slug),
		label: asString(attribute.label),
		unit: asString(attribute.unit) || undefined,
		options: sortAttributeOptions(
			asArray<AttributeAttributes["options"][number]>(attribute.options).map((option) => ({
				value: asString(option?.value),
				label: asString(option?.label),
			})),
			asString(attribute.unit) || undefined,
		),
		visibility: parseAttributeVisibility(attribute.visibility),
		cardPosition: normalizeAttributeCardPosition(attribute.cardPosition),
	};
}

/**
 * Attach server-resolved lucide geometry to each bullet so the storefront
 * renders structured-content icons with no client-side registry. Returns
 * `undefined` when there is nothing to render.
 */
export function attachBulletIconNodes(content: StructuredContent): StructuredContent | undefined {
	if (!hasStructuredContent(content)) {
		return undefined;
	}
	return {
		...content,
		bullets: content.bullets.map((bullet) => ({
			...bullet,
			iconNode: resolveIconNode(bullet.icon),
		})),
	};
}

/** Coerce a raw stored-image array off a lean document into a clean
 *  `StoredImage[]`, dropping anything that doesn't pass `coerceStoredImage`. */
function asStoredImageArray(raw: unknown): StoredImage[] {
	return asArray<unknown>(raw)
		.map(coerceStoredImage)
		.filter((image): image is StoredImage => image !== null);
}

export function toStorefrontVariant(variant: VariantAttributes, fallbackId?: string): Variant {
	const id = objectIdString(variant._id) || fallbackId || "";
	return {
		id,
		priceRupees: asNumber(variant.priceRupees),
		quantity: variant.quantity ?? 0,
		forceOutOfStock: variant.forceOutOfStock === true,
		warrantyDays: resolveWarrantyDays(variant),
		attributes: variant.attributes ?? {},
		attributeDisplay: variant.attributeDisplay,
		images: asStoredImageArray(variant.images),
	};
}

function toVariant(variant: VariantAttributes, fallbackId?: string): Variant {
	return toStorefrontVariant(variant, fallbackId);
}

/**
 * Product → public Product. Caller supplies the category+brand → brand-name
 * map so we don't issue an N+1 against the Brand collection.
 *
 * Returns `null` when the brand reference is broken — the storefront
 * silently drops such rows rather than ship a card with an empty brand
 * line. Admin tooling surfaces these dangling rows separately.
 */
export function toProduct(product: ProductLean, brandsByCategoryAndSlug: Map<string, { slug: string; name: string }>): Product | null {
	const categorySlug = asString(product.categorySlug);
	const brand = brandsByCategoryAndSlug.get(`${categorySlug}:${asString(product.brandSlug)}`);
	if (!brand) {
		return null;
	}

	const images = asStoredImageArray(product.images);

	return {
		id: objectIdString(product._id),
		slug: asString(product.slug),
		name: asString(product.name),
		brandSlug: brand.slug,
		brandName: brand.name,
		categorySlug,
		isFeatured: product.isFeatured ?? false,
		images,
		variants: asArray<VariantAttributes>(product.variants).map((variant, index) => {
			const productId = objectIdString(product._id);
			const fallbackId = productId ? `${productId}-v${index}` : `variant-${index}`;
			return toVariant(variant, fallbackId);
		}),
		...(Array.isArray(product.attributeSlugs)
			? {
					attributeSlugs: product.attributeSlugs.filter((slug): slug is string => typeof slug === "string" && slug.length > 0),
				}
			: {}),
		...(product.attributeOptionPool && typeof product.attributeOptionPool === "object" && !Array.isArray(product.attributeOptionPool)
			? { attributeOptionPool: product.attributeOptionPool as Record<string, string[]> }
			: {}),
		...(product.attributeCustomOptions && typeof product.attributeCustomOptions === "object" && !Array.isArray(product.attributeCustomOptions)
			? {
					attributeCustomOptions: product.attributeCustomOptions as Record<string, Array<{ value: string; label: string }>>,
				}
			: {}),
		...(product.attributeDefaults && typeof product.attributeDefaults === "object" && !Array.isArray(product.attributeDefaults)
			? { attributeDefaults: product.attributeDefaults as Record<string, string> }
			: {}),
		seo: product.seo,
	};
}

export function toOffer(offer: OfferLean): Offer {
	const description = asString(offer.description);
	const content = normalizeStructuredContent(offer.content, description);
	return {
		id: objectIdString(offer._id),
		slug: asString(offer.slug),
		title: asString(offer.title),
		description,
		discountLabel: asString(offer.discountLabel),
		expiresAt: offer.schedule?.endDate ? toIsoDate(offer.schedule.endDate) : undefined,
		/* `#e1ff51` is the literal value of `--color-accent-500` (chartreuse).
       Offers without an admin-chosen colour fall back to the brand accent. */
		color: asString(offer.color, "#e1ff51"),
		badgeLabel: asString(offer.badgeLabel),
		bannerImage: isStoredImage(offer.bannerImage) ? offer.bannerImage : undefined,
		content: attachBulletIconNodes(content),
		seo: offer.seo,
	};
}

