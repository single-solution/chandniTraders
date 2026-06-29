import type { AdminCategory } from "@/types/models";
import type { CatalogDrawerState } from "@/lib/url/catalogDrawerUrl";

export type CatalogTab = "brands" | "attributes";
export type WorkspaceView = "tables" | "cards";

export const CATALOG_TABS: CatalogTab[] = ["brands", "attributes"];

export type DrawerKind = CatalogDrawerState;

export interface DeleteIntent {
	kind: "category" | "brand" | "attribute";
	id: string;
	label: string;
	unlinkFromCategorySlug?: string;
}

export interface CategoryNavItem {
	category: AdminCategory;
	brandCount: number;
	attributeCount: number;
}

export function matchesQuery(haystack: string, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return haystack.toLowerCase().includes(needle);
}

export function isCatalogTab(value: string | null): value is CatalogTab {
	return value !== null && CATALOG_TABS.includes(value as CatalogTab);
}
