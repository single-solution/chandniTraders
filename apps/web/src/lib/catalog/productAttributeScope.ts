"use client";

import { useMemo } from "react";

import { resolveScopedProductAttributes, type Product } from "@store/shared";

import { useAttributesForCategory } from "@/lib/core/storefrontReferenceContext";

export function useProductAttributeScope(product: Product) {
	const categoryAttributes = useAttributesForCategory(product.categorySlug);
	return useMemo(() => resolveScopedProductAttributes(product, categoryAttributes), [product, categoryAttributes]);
}
