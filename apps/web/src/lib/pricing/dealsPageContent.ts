import type { Offer } from "@store/shared";

import type { ProductPage } from "@/lib/core";
import { getCatalogDeals, getCheckoutNoticeOffers, getProductsPage } from "@/lib/core/queries";

export type DealsPageContent = {
	catalogDeals: Offer[];
	checkoutNotices: Offer[];
	productPage: ProductPage;
};

export const DEALS_PRODUCT_PAGE_SIZE = 24;

/** Active offers + in-stock catalog for `/deals`. */
export async function loadDealsPageContent(): Promise<DealsPageContent> {
	const [catalogDeals, checkoutNotices, productPage] = await Promise.all([
		getCatalogDeals(),
		getCheckoutNoticeOffers(),
		getProductsPage({
			inStockOnly: true,
			limit: DEALS_PRODUCT_PAGE_SIZE,
			page: 1,
			sort: "recently-updated",
		}),
	]);

	return {
		catalogDeals,
		checkoutNotices,
		productPage,
	};
}
