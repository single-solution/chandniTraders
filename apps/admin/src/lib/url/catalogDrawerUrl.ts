import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";

export type CatalogDrawerKind = "category" | "brand" | "attribute";

export type CatalogDrawerState =
	| { kind: "category"; category: AdminCategory | null }
	| { kind: "brand"; category: AdminCategory; brand: AdminBrand | null }
	| {
			kind: "attribute";
			category: AdminCategory;
			attribute: AdminAttribute | null;
	  }
	| null;

export function drawerUrlSignature(drawer: string | null, item: string | null): string | null {
	if (!drawer) return null;
	return `${drawer}:${item ?? ""}`;
}

export function drawerItemFromState(state: CatalogDrawerState): string | null {
	if (!state) return null;
	if (state.kind === "category") return state.category?.id ?? null;
	if (state.kind === "brand") return state.brand?.id ?? null;
	return state.attribute?.id ?? null;
}

export function resolveCatalogDrawer(params: {
	drawer: string | null;
	item: string | null;
	category: AdminCategory | null;
	categories: AdminCategory[];
	brands: AdminBrand[];
	attributes: AdminAttribute[];
}): CatalogDrawerState {
	const { drawer, item, category, categories, brands, attributes } = params;
	if (!drawer) return null;

	if (drawer === "category") {
		const resolved = item ? (categories.find((row) => row.id === item) ?? null) : null;
		return { kind: "category", category: resolved };
	}

	if (!category) return null;

	if (drawer === "brand") {
		const brand = item ? (brands.find((row) => row.id === item) ?? null) : null;
		return { kind: "brand", category, brand };
	}
	if (drawer === "attribute") {
		const attribute = item ? (attributes.find((row) => row.id === item) ?? null) : null;
		return { kind: "attribute", category, attribute };
	}

	return null;
}

export function parseCatalogDeleteParam(value: string | null): { kind: CatalogDrawerKind | "category"; id: string } | null {
	if (!value) return null;
	const colon = value.indexOf(":");
	if (colon <= 0) return null;
	const kind = value.slice(0, colon);
	const id = value.slice(colon + 1);
	if (kind !== "category" && kind !== "brand" && kind !== "attribute") {
		return null;
	}
	return { kind, id };
}

export function formatCatalogDeleteParam(kind: string, id: string): string {
	return `${kind}:${id}`;
}
