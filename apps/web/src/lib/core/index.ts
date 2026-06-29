/**
 * Public storefront data layer barrel.
 */

export {
	getBrands,
	getBrandBySlug,
	getProducts,
	getProductsPage,
	getProductBySlug,
	getOffers,
	getCatalogDeals,
	getCheckoutNoticeOffers,
	getCategories,
	getCategoryMetaBySlug,
	hasAnyProducts,
} from "@/lib/core/queries";

export { getFacets } from "@/lib/core/facets";
export { getSearchHints } from "@/lib/core/hints";
export type { AttributeFacet, FacetOption } from "@/lib/core/facets";

export type { CategoryMeta, ProductFilters, ProductPage, SortOption } from "@/lib/core/queries";

export { FILTER_PARAM_KEYS, parseFiltersFromSearchParams, buildSearchParamsFromFilters } from "@/lib/core/filterParams";
