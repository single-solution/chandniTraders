"use client";

import { Suspense } from "react";

import { TableSkeleton } from "@/components/loading/TableSkeleton";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";

import { CategoriesCatalogInner } from "./CategoriesCatalogInner";

export interface CategoriesCatalogProps {
	initialCategories: AdminCategory[];
	initialBrands: AdminBrand[];
	initialAttributes: AdminAttribute[];
}

export function CategoriesCatalog(props: CategoriesCatalogProps) {
	return (
		<Suspense fallback={<TableSkeleton columnCount={4} rowCount={8} />}>
			<CategoriesCatalogInner {...props} />
		</Suspense>
	);
}
