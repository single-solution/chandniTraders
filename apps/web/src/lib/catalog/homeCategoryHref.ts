/** Category links on `/` — default catalog category has a clean `/` URL. */
export function homeCategoryHref(slug: string, homeCategorySlug: string): string {
	return slug === homeCategorySlug ? "/" : `/?category=${encodeURIComponent(slug)}`;
}
