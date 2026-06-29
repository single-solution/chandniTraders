import { DEFAULT_PAGE_SIZE, MAX_INPUT_LENGTH, MAX_PAGE_SIZE, escapeRegex, safeParseInt } from "@store/shared";

interface ListOptions {
	page: number;
	limit: number;
	skip: number;
	/** Caller-provided search text — already trimmed and length-capped. */
	search: string;
	/**
	 * Regex-safe form of {@link search}. Pass this to `$regex` filters; pass
	 * the raw {@link search} only to non-regex matchers.
	 */
	searchPattern: string;
}

/**
 * Extract `page`, `limit`, and `query` (search text) from a request URL with
 * safe bounds. Used by every paginated list endpoint so behaviour is uniform.
 *
 * Search text is length-capped and regex-escaped (`searchPattern`) to defend
 * against regex-injection / catastrophic-backtracking attacks via the `$regex`
 * filter (security.md § Input Validation, § SQL/NoSQL Injection Prevention).
 */
export function readListOptions(request: Request): ListOptions {
	const url = new URL(request.url);
	const page = Math.max(1, safeParseInt(url.searchParams.get("page"), 1));
	const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, safeParseInt(url.searchParams.get("limit"), DEFAULT_PAGE_SIZE)));
	const rawSearch = url.searchParams.get("query") ?? "";
	const search = rawSearch.trim().slice(0, MAX_INPUT_LENGTH);

	return {
		page,
		limit,
		skip: (page - 1) * limit,
		search,
		searchPattern: escapeRegex(search),
	};
}

/** Standard envelope returned by every list endpoint. */
export interface ListResponse<TItem> {
	items: TItem[];
	total: number;
	page: number;
	limit: number;
}
