"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import type { Product } from "@store/shared";

import {
	findVariantBySelection,
	getRequiredAttributeSlugsForProduct,
	hasPdpConfigurationInSearch,
	isPdpSelectionComplete,
	parsePdpSelectionFromSearch,
	resolvePickerSelection,
	selectionToUrlPatch,
} from "@/lib/catalog/pdpSelection";
import { useProductAttributeScope } from "@/lib/catalog/productAttributeScope";
import { usePdpUrlParams } from "@/lib/core/usePdpUrlParams";

interface VariantContextValue {
	selectedVariantId: string;
	currentSelection: Record<string, string>;
	pick: (dimensionKey: string, optionKey: string) => PickResult;
}

export interface PickResult {
	clickedDimensionKey: string;
	before: Record<string, string>;
	after: Record<string, string>;
}

const VariantContext = createContext<VariantContextValue | null>(null);

interface VariantProviderProps {
	product: Product;
	children: ReactNode;
}

/**
 * PDP variant selection — query params are the only source of truth.
 * Chip state, price, and stock all derive from the URL; picks call
 * `history.replaceState` via {@link usePdpUrlParams}.
 */
export function VariantProvider({ product, children }: VariantProviderProps) {
	const { searchParams, replace } = usePdpUrlParams();
	const { attributes: scopedAttributes } = useProductAttributeScope(product);
	const attributeSlugs = useMemo(() => scopedAttributes.map((row) => row.slug), [scopedAttributes]);
	const requiredAttributeSlugs = useMemo(() => getRequiredAttributeSlugsForProduct(product, attributeSlugs), [product, attributeSlugs]);

	const searchRecord = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

	const currentSelection = useMemo(() => parsePdpSelectionFromSearch(searchRecord, attributeSlugs), [searchRecord, attributeSlugs]);

	const selectedVariantId = useMemo(() => {
		if (!isPdpSelectionComplete(currentSelection, requiredAttributeSlugs)) {
			return "";
		}
		return findVariantBySelection(product.variants, currentSelection)?.id ?? "";
	}, [currentSelection, requiredAttributeSlugs, product.variants]);

	useEffect(() => {
		if (!hasPdpConfigurationInSearch(searchRecord, attributeSlugs)) {
			return;
		}
		if (!findVariantBySelection(product.variants, currentSelection)) {
			replace(selectionToUrlPatch({}, attributeSlugs));
		}
	}, [searchRecord, attributeSlugs, product.variants, currentSelection, replace]);

	const pick = useCallback(
		(dimensionKey: string, optionKey: string): PickResult => {
			const before = parsePdpSelectionFromSearch(Object.fromEntries(searchParams.entries()), attributeSlugs);

			const proposed = { ...before, [dimensionKey]: optionKey };
			const { selection } = resolvePickerSelection(product.variants, proposed, dimensionKey);
			replace(selectionToUrlPatch(selection, attributeSlugs));
			return { clickedDimensionKey: dimensionKey, before, after: selection };
		},
		[searchParams, attributeSlugs, product.variants, replace],
	);

	const value = useMemo(
		() => ({
			selectedVariantId,
			currentSelection,
			pick,
		}),
		[selectedVariantId, currentSelection, pick],
	);

	return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}

export function useSelectedVariantId(): string {
	const context = useContext(VariantContext);
	if (!context) {
		throw new Error("useSelectedVariantId must be used within a VariantProvider");
	}
	return context.selectedVariantId;
}

export function useVariantSelection(): VariantContextValue {
	const context = useContext(VariantContext);
	if (!context) {
		throw new Error("useVariantSelection must be used within a VariantProvider");
	}
	return context;
}
