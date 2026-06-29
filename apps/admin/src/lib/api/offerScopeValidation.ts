import { connectDB, Offer, Product } from "@store/db";
import {
	findOfferCatalogScopeConflict,
	formatOfferScopeConflictMessage,
	type OfferCatalogProduct,
	type OfferCondition,
} from "@store/shared";

type OfferLean = {
	_id: { toString(): string };
	title: string;
	conditions: OfferCondition[];
};

type ProductLean = {
	_id: { toString(): string };
	name: string;
	categorySlug: string;
	brandSlug: string;
	variants?: Array<{
		attributes?: Record<string, string | string[]>;
	}>;
};

function toCatalogProduct(row: ProductLean): OfferCatalogProduct {
	return {
		id: row._id.toString(),
		name: row.name,
		categorySlug: row.categorySlug,
		brandSlug: row.brandSlug,
		variants: (row.variants ?? []).map((variant) => ({
			attributes: variant.attributes ?? {},
		})),
	};
}

/**
 * Loads catalog peers and returns a user-facing conflict message, or null if safe.
 */
export async function validateOfferCatalogScopeConflict(
	candidateConditions: OfferCondition[],
	excludeOfferId?: string,
): Promise<string | null> {
	await connectDB();

	const [offerRows, productRows] = await Promise.all([
		Offer.find({})
			.select("title conditions")
			.lean<OfferLean[]>(),
		Product.find({ isArchived: { $ne: true } })
			.select("name categorySlug brandSlug variants.attributes")
			.lean<ProductLean[]>(),
	]);

	const existingOffers = offerRows.map((row) => ({
		id: row._id.toString(),
		title: row.title,
		conditions: row.conditions ?? [],
	}));
	const products = productRows.map(toCatalogProduct);

	const conflict = findOfferCatalogScopeConflict(candidateConditions, existingOffers, products, excludeOfferId);
	if (!conflict) {
		return null;
	}

	return formatOfferScopeConflictMessage(conflict);
}
