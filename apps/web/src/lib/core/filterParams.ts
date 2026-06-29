/**
 * URL search-param ↔ `ProductFilters` adapter.
 *
 * Lives in its own module so the shop list page (server) and the filter
 * sidebar (client) both read/write the exact same param keys without one
 * accidentally drifting from the other. `categorySlug` is not read from the
 * query string — the URL path segment carries it.
 */

import type { ProductFilters, SortOption } from "@/lib/core/queries";
import { DECIMAL_RADIX } from "@store/shared";

const SEARCH_QUERY_MAX_CHARS = 100;
/** Prefix on URL keys that carry an admin-defined attribute filter. */
const ATTRIBUTE_PARAM_PREFIX = "attr.";

/** Public URL keys. Keep these short and stable — they're shareable links. */
export const FILTER_PARAM_KEYS = {
	category: "category",
	brands: "brand",
	minPrice: "min",
	maxPrice: "max",
	inStock: "stock",
	sort: "sort",
	page: "page",
	search: "q",
} as const;

const VALID_SORTS: readonly SortOption[] = ["newest", "recently-updated", "price-asc", "price-desc", "name-asc"];

const isSortOption = (value: string): value is SortOption => (VALID_SORTS as readonly string[]).includes(value);

/**
 * Read either a `URLSearchParams` instance or a server-provided
 * `Record<string, string | string[] | undefined>` in a uniform way. Returns
 * an array of values for the given key; comma-separated values are
 * exploded.
 */
function readMulti(source: URLSearchParams | Record<string, string | string[] | undefined>, key: string): string[] {
	let raw: string[] = [];
	if (source instanceof URLSearchParams) {
		raw = source.getAll(key);
	} else {
		const value = source[key];
		if (Array.isArray(value)) {
			raw = value;
		} else if (typeof value === "string") {
			raw = [value];
		}
	}
	const collected: string[] = [];
	for (const entry of raw) {
		for (const part of entry.split(",")) {
			const trimmed = part.trim();
			if (trimmed) {
				collected.push(trimmed);
			}
		}
	}
	return collected;
}

function readSingle(source: URLSearchParams | Record<string, string | string[] | undefined>, key: string): string | undefined {
	if (source instanceof URLSearchParams) {
		return source.get(key) ?? undefined;
	}
	const value = source[key];
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

function readPositiveInt(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, DECIMAL_RADIX);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function entries(source: URLSearchParams | Record<string, string | string[] | undefined>): Array<[string, string | string[]]> {
	if (source instanceof URLSearchParams) {
		const result: Array<[string, string | string[]]> = [];
		for (const key of new Set(source.keys())) {
			const all = source.getAll(key);
			result.push([key, all.length === 1 ? all[0] : all]);
		}
		return result;
	}
	return Object.entries(source).filter((entry): entry is [string, string | string[]] => entry[1] !== undefined);
}

/**
 * Parse search params into a `ProductFilters`. Bad/unknown
 * values are dropped silently — the rule is "best effort, never 500".
 *
 * `categorySlug` is *not* read from query — it comes from the URL path
 * segment — so the caller is expected to set it explicitly.
 */
export function parseFiltersFromSearchParams(source: URLSearchParams | Record<string, string | string[] | undefined>, defaults: { categorySlug?: string } = {}): ProductFilters {
	const filters: ProductFilters = {};
	
	const categoryQuery = readSingle(source, FILTER_PARAM_KEYS.category);
	if (categoryQuery) {
		filters.categorySlug = categoryQuery;
	} else if (defaults.categorySlug) {
		filters.categorySlug = defaults.categorySlug;
	}

	const brandSlugs = readMulti(source, FILTER_PARAM_KEYS.brands);
	if (brandSlugs.length > 0) {
		filters.brandSlugs = brandSlugs;
	}

	const minPrice = readPositiveInt(readSingle(source, FILTER_PARAM_KEYS.minPrice));
	const maxPrice = readPositiveInt(readSingle(source, FILTER_PARAM_KEYS.maxPrice));
	if (minPrice !== undefined) {
		filters.minPriceRupees = minPrice;
	}
	if (maxPrice !== undefined && maxPrice > 0) {
		filters.maxPriceRupees = maxPrice;
	}

	const attributes: Record<string, string[]> = {};
	for (const [key] of entries(source)) {
		if (!key.startsWith(ATTRIBUTE_PARAM_PREFIX)) {
			continue;
		}
		const slug = key.slice(ATTRIBUTE_PARAM_PREFIX.length);
		if (!slug) {
			continue;
		}
		const values = readMulti(source, key);
		if (values.length > 0) {
			attributes[slug] = values;
		}
	}
	if (Object.keys(attributes).length > 0) {
		filters.attributes = attributes;
	}

	if (readSingle(source, FILTER_PARAM_KEYS.inStock) === "1") {
		filters.inStockOnly = true;
	}

	const sort = readSingle(source, FILTER_PARAM_KEYS.sort);
	if (sort && isSortOption(sort)) {
		filters.sort = sort;
	}

	const page = readPositiveInt(readSingle(source, FILTER_PARAM_KEYS.page));
	if (page !== undefined && page > 0) {
		filters.page = page;
	}

	const search = readSingle(source, FILTER_PARAM_KEYS.search);
	if (search && search.trim().length > 0) {
		filters.search = search.trim().slice(0, SEARCH_QUERY_MAX_CHARS);
	}

	return filters;
}

/**
 * Convert a filters object to a `URLSearchParams` instance. Empty / default
 * values are omitted so the URL stays minimal.
 */
export function buildSearchParamsFromFilters(filters: Omit<ProductFilters, "categorySlug" | "categorySlugs">): URLSearchParams {
	const params = new URLSearchParams();
	const setMulti = (key: string, values?: readonly string[]) => {
		if (!values || values.length === 0) {
			return;
		}
		params.set(key, values.map(String).join(","));
	};

	setMulti(FILTER_PARAM_KEYS.brands, filters.brandSlugs);
	if (typeof filters.minPriceRupees === "number" && filters.minPriceRupees > 0) {
		params.set(FILTER_PARAM_KEYS.minPrice, String(filters.minPriceRupees));
	}
	if (typeof filters.maxPriceRupees === "number" && filters.maxPriceRupees > 0) {
		params.set(FILTER_PARAM_KEYS.maxPrice, String(filters.maxPriceRupees));
	}
	if (filters.attributes) {
		for (const [slug, values] of Object.entries(filters.attributes)) {
			if (values.length === 0) {
				continue;
			}
			params.set(`${ATTRIBUTE_PARAM_PREFIX}${slug}`, values.join(","));
		}
	}
	if (filters.inStockOnly) {
		params.set(FILTER_PARAM_KEYS.inStock, "1");
	}
	if (filters.sort && filters.sort !== "newest") {
		params.set(FILTER_PARAM_KEYS.sort, filters.sort);
	}
	if (filters.page && filters.page > 1) {
		params.set(FILTER_PARAM_KEYS.page, String(filters.page));
	}
	if (filters.search) {
		params.set(FILTER_PARAM_KEYS.search, filters.search);
	}
	return params;
}

/** True when brand, price, stock, or attribute filters are set in the URL. */
export function hasActiveListingFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): boolean {
	const searchParams =
		params instanceof URLSearchParams
			? params
			: new URLSearchParams(
					Object.entries(params).flatMap(([key, value]) => {
						if (value === undefined) {
							return [];
						}
						if (Array.isArray(value)) {
							return value.map((entry) => [key, entry]);
						}
						return [[key, value]];
					}),
				);

	for (const key of Object.values(FILTER_PARAM_KEYS)) {
		if (key === FILTER_PARAM_KEYS.sort || key === FILTER_PARAM_KEYS.page || key === FILTER_PARAM_KEYS.search) {
			continue;
		}
		if (searchParams.get(key)) {
			return true;
		}
	}
	for (const key of Array.from(searchParams.keys())) {
		if (key.startsWith(ATTRIBUTE_PARAM_PREFIX) && searchParams.get(key)) {
			return true;
		}
	}
	return false;
}
