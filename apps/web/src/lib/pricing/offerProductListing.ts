import { Offer as OfferModel, connectDB } from "@store/db";
import type { ActiveOffer } from "@store/shared";
import { extractOfferScenarios, isOfferActiveSchedule, summarizeScenarioScope, toActiveOffer } from "@store/shared";

import type { ProductFilters, ProductPage } from "@/lib/core/queries";
import { getProductsPage } from "@/lib/core/queries";
import { productMatchesStorefrontOffer } from "@/lib/pricing/productOfferMatch";

const OFFER_SCAN_BATCH_SIZE = 60;

type OfferLean = {
	_id: { toString(): string };
	slug: string;
	isActive: boolean;
	schedule?: Parameters<typeof isOfferActiveSchedule>[0];
};

async function loadActiveOfferBySlug(offerSlug: string): Promise<ActiveOffer | null> {
	await connectDB();
	const doc = await OfferModel.findOne({ slug: offerSlug, isActive: true }).lean<OfferLean>();
	if (!doc) {
		return null;
	}
	const offer = toActiveOffer(doc);
	if (!isOfferActiveSchedule(offer.schedule, new Date())) {
		return null;
	}
	return offer;
}

function emptyProductPage(options: ProductFilters): ProductPage {
	const pageSize = options.limit ?? 24;
	const page = options.page ?? 1;
	return {
		products: [],
		total: 0,
		page,
		pageSize,
		pageCount: 1,
	};
}

function buildLooseScanFilters(offer: ActiveOffer, options: ProductFilters): ProductFilters {
	const scenarios = extractOfferScenarios(offer.conditions);
	const categorySlugs = new Set<string>();
	const brandSlugs = new Set<string>();

	for (const scenario of scenarios) {
		const scope = summarizeScenarioScope(scenario);
		scope.categorySlugs.forEach((slug) => categorySlugs.add(slug));
		scope.brandSlugs.forEach((slug) => brandSlugs.add(slug));
	}

	const scanFilters: ProductFilters = { ...options, offerSlug: undefined };
	if (categorySlugs.size > 0) {
		scanFilters.categorySlugs = [...categorySlugs];
	}
	if (brandSlugs.size > 0) {
		scanFilters.brandSlugs = [...brandSlugs];
	}
	return scanFilters;
}

async function listOfferMatchedProducts(offer: ActiveOffer, options: ProductFilters) {
	const scanFilters = buildLooseScanFilters(offer, options);
	const matched: Awaited<ReturnType<typeof getProductsPage>>["products"] = [];
	let batchPage = 1;

	while (true) {
		const batch = await getProductsPage({
			...scanFilters,
			page: batchPage,
			limit: OFFER_SCAN_BATCH_SIZE,
		});

		for (const product of batch.products) {
			if (productMatchesStorefrontOffer(product, offer)) {
				matched.push(product);
			}
		}

		if (batch.products.length === 0 || batchPage >= batch.pageCount) {
			break;
		}
		batchPage += 1;
	}

	return matched;
}

/** Paginated in-stock catalog slice for one live offer slug. */
export async function resolveProductsPageForOfferSlug(offerSlug: string, options: ProductFilters): Promise<ProductPage> {
	const offer = await loadActiveOfferBySlug(offerSlug);
	if (!offer) {
		return emptyProductPage(options);
	}

	const { offerSlug: _ignored, ...baseOptions } = options;

	const pageSize = baseOptions.limit ?? 24;
	const page = baseOptions.page ?? 1;
	const matched = await listOfferMatchedProducts(offer, baseOptions);
	const start = (page - 1) * pageSize;
	const products = matched.slice(start, start + pageSize);

	return {
		products,
		total: matched.length,
		page,
		pageSize,
		pageCount: Math.max(1, Math.ceil(matched.length / pageSize)),
	};
}
