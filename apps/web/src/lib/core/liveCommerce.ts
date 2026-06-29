/**
 * Fresh per-variant commerce data for the PDP.
 *
 * The PDP shell (gallery, name, breadcrumbs) comes from
 * `getProductBySlugCached` — cross-request cached with admin-tag busting.
 * Variant rows are always loaded live here so admin edits (delete/recreate
 * variants) never leave stale `_id`s on the configurator or in the cart.
 *
 * Wrapped in React `cache()` so mobile + desktop Suspense boundaries on the
 * same PDP share one Mongo round-trip per render.
 */
import { cache } from "react";

import { connectDB, Product as ProductModel, type VariantAttributes } from "@store/db";
import type { Product, Variant } from "@store/shared";
import { objectIdString } from "@store/shared";

import { toStorefrontVariant } from "@/lib/core/serializers";
import { applyCatalogVisibility, PUBLIC_PRODUCT_FILTER, resolveCatalogVisibility } from "@/lib/core/queries";

interface ProductLiveLean {
	_id?: unknown;
	variants?: VariantAttributes[];
}

async function fetchProductLiveCommerce(slug: string): Promise<Variant[] | null> {
	await connectDB();
	const filter: Record<string, unknown> = {
		slug: slug.toLowerCase(),
		...PUBLIC_PRODUCT_FILTER,
	};
	applyCatalogVisibility(filter, await resolveCatalogVisibility());
	const product = await ProductModel.findOne(filter, { variants: 1, _id: 1 }).lean<ProductLiveLean>();

	if (!product) {
		return null;
	}

	const productId = objectIdString(product._id);

	return (product.variants ?? []).map((variant, index) => {
		const fallbackId = productId ? `${productId}-v${index}` : `variant-${index}`;
		return toStorefrontVariant(variant, fallbackId);
	});
}

/**
 * Per-render-deduped live commerce fetch. Mobile + desktop Suspense
 * boundaries on the same PDP share one Mongo hit; cross-request is
 * always fresh.
 */
export const getProductLiveCommerce = cache(fetchProductLiveCommerce);

/**
 * Replace the cached shell's variant list with live DB rows when available.
 * Drops variants removed in admin; adds newly created ones.
 */
export function mergeProductWithLiveCommerce(product: Product, live: Variant[] | null): Product {
	if (live === null || live.length === 0) {
		return product;
	}

	const shellById = new Map(product.variants.map((variant) => [variant.id, variant]));
	const variants = live.map((liveVariant) => {
		const shellVariant = shellById.get(liveVariant.id);
		if (!shellVariant) {
			return liveVariant;
		}
		return {
			...shellVariant,
			...liveVariant,
		};
	});

	const shellIds = product.variants.map((variant) => variant.id).join(",");
	const nextIds = variants.map((variant) => variant.id).join(",");
	if (shellIds === nextIds && variants.every((variant, index) => variant === product.variants[index])) {
		return product;
	}

	return { ...product, variants };
}
