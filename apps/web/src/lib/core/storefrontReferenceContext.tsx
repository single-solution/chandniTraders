"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { compareAlphabetically, sortAttributeOptions, type AttributeDescriptor, type Product, type Variant } from "@store/shared";

import { catalogRootHref, productHref } from "@/lib/catalog/productPaths";
import type { CategoryMeta } from "@/lib/core";

export interface ReferenceData {
	attributes: AttributeDescriptor[];
	categories: CategoryReference[];
}

export interface CategoryReference {
	slug: string;
	label: string;
	description: string;
	icon: CategoryMeta["icon"];
	iconNode: CategoryMeta["iconNode"];
	isActive: boolean;
	sortOrder: number;
}

const EMPTY_REFERENCE: ReferenceData = {
	attributes: [],
	categories: [],
};

const ReferenceContext = createContext<ReferenceData>(EMPTY_REFERENCE);

interface ProviderProps {
	value: ReferenceData;
	children: ReactNode;
}

export function ReferenceProvider({ value, children }: ProviderProps) {
	return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export function useAttributes(): AttributeDescriptor[] {
	return useContext(ReferenceContext).attributes;
}

export function useAttributesForCategory(categorySlug: string): AttributeDescriptor[] {
	const attributes = useAttributes();
	return useMemo(
		() =>
			attributes
				.filter((attribute) => attribute.categorySlug === categorySlug)
				.map((attribute) => ({
					...attribute,
					options: sortAttributeOptions(attribute.options, attribute.unit),
				}))
				.sort((left, right) => compareAlphabetically(left.label, right.label)),
		[attributes, categorySlug],
	);
}

export function useCategories(): CategoryReference[] {
	return useContext(ReferenceContext).categories;
}

export function useCategory(slug: string): CategoryReference | undefined {
	const categories = useCategories();
	return useMemo(() => categories.find((category) => category.slug === slug), [categories, slug]);
}

export function useShopHref(): string {
	return catalogRootHref();
}

export function useIsCatalogHome(pathname: string): boolean {
	return pathname === catalogRootHref();
}

export function useCategorySegment(categorySlug: string): string {
	return categorySlug;
}

export function useProductHref(product: Pick<Product, "categorySlug" | "slug">, variant?: Variant): string {
	if (!product.categorySlug || !product.slug) {
		return catalogRootHref();
	}
	return productHref(product, variant ? { variant } : undefined);
}
