import type { Product, Variant } from "@store/shared";
import { isVariantInStock } from "@store/shared";

import { getDefaultVariant } from "@/lib/productSummary";

const RESERVED_PDP_PARAMS = new Set(["compare"]);

export function attributeValuesOnVariant(variant: Variant, slug: string): string[] {
	const raw = variant.attributes?.[slug];
	if (!raw) {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw.filter((entry) => entry.length > 0);
	}
	return [raw];
}

function variantHasAttributeValue(variant: Variant, slug: string, value: string): boolean {
	return attributeValuesOnVariant(variant, slug).includes(value);
}

export function variantMatchesSelection(variant: Variant, selection: Record<string, string>): boolean {
	for (const [key, want] of Object.entries(selection)) {
		if (!want) {
			continue;
		}
		if (!variantHasAttributeValue(variant, key, want)) {
			return false;
		}
	}
	return true;
}

function countMatchingDimensions(variant: Variant, selection: Record<string, string>): number {
	let matchCount = 0;
	for (const [key, want] of Object.entries(selection)) {
		if (!want) {
			continue;
		}
		if (variantHasAttributeValue(variant, key, want)) {
			matchCount += 1;
		}
	}
	return matchCount;
}

export function selectionFromVariant(variant: Variant): Record<string, string> {
	const result: Record<string, string> = {};
	for (const slug of Object.keys(variant.attributes ?? {})) {
		const values = attributeValuesOnVariant(variant, slug);
		if (values.length > 0) {
			result[slug] = values[0];
		}
	}
	return result;
}

export function selectionFromVariantPreservingPicks(variant: Variant, picks: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const slug of Object.keys(variant.attributes ?? {})) {
		const values = attributeValuesOnVariant(variant, slug);
		if (values.length === 0) {
			continue;
		}
		const pick = picks[slug];
		result[slug] = pick && values.includes(pick) ? pick : values[0];
	}
	return result;
}

export function findVariantBySelection(variants: Variant[], selection: Record<string, string>): Variant | undefined {
	return variants.find((variant) => variantMatchesSelection(variant, selection));
}

export function findClosestVariant(variants: Variant[], selection: Record<string, string>, priorityKey: string): Variant | undefined {
	const pinnedValue = selection[priorityKey];
	let bestVariant: Variant | undefined;
	let bestScore = -1;
	for (const variant of variants) {
		if (pinnedValue && !variantHasAttributeValue(variant, priorityKey, pinnedValue)) {
			continue;
		}
		const matchCount = countMatchingDimensions(variant, selection);
		const inStock = isVariantInStock(variant);
		const score = matchCount * 1000 + (inStock ? 10 : 0) - Math.min(9, Math.floor((variant.priceRupees ?? 0) / 100_000));
		if (score > bestScore) {
			bestScore = score;
			bestVariant = variant;
		}
	}
	return bestVariant;
}

function activeSelectionKeys(selection: Record<string, string>): string[] {
	return Object.entries(selection)
		.filter(([, value]) => value)
		.map(([key]) => key);
}

export function resolvePickerSelection(variants: Variant[], selection: Record<string, string>, priorityKey?: string): { variant: Variant; selection: Record<string, string> } {
	if (variants.length === 0) {
		const empty: Variant = {
			id: "",
			priceRupees: 0,
			quantity: 0,
			forceOutOfStock: false,
			warrantyDays: 0,
			attributes: {},
		};
		return { variant: empty, selection: {} };
	}

	const exact = findVariantBySelection(variants, selection);
	if (exact) {
		return {
			variant: exact,
			selection: selectionFromVariantPreservingPicks(exact, selection),
		};
	}

	if (priorityKey && selection[priorityKey]) {
		const pinned = findClosestVariant(variants, selection, priorityKey);
		if (pinned) {
			return {
				variant: pinned,
				selection: selectionFromVariantPreservingPicks(pinned, selection),
			};
		}
	}

	const keys = activeSelectionKeys(selection);
	const tryOrder = priorityKey ? [priorityKey, ...keys.filter((key) => key !== priorityKey)] : keys;

	let best: Variant | undefined;
	let bestMatchCount = -1;

	for (const key of tryOrder) {
		if (!selection[key]) {
			continue;
		}
		const closest = findClosestVariant(variants, selection, key);
		if (!closest) {
			continue;
		}
		const matchCount = countMatchingDimensions(closest, selection);
		if (matchCount > bestMatchCount) {
			bestMatchCount = matchCount;
			best = closest;
		}
	}

	if (best) {
		return { variant: best, selection: selectionFromVariant(best) };
	}

	const fallback = getDefaultVariant({ variants } as Product);
	return { variant: fallback, selection: selectionFromVariant(fallback) };
}

export function getRequiredAttributeSlugsForProduct(product: Product, categoryAttributeSlugs: string[]): string[] {
	const required: string[] = [];
	for (const slug of categoryAttributeSlugs) {
		const distinct = new Set<string>();
		for (const variant of product.variants) {
			for (const value of attributeValuesOnVariant(variant, slug)) {
				distinct.add(value);
			}
		}
		if (distinct.size > 1) {
			required.push(slug);
		}
	}
	return required;
}

export function isPdpSelectionComplete(selection: Record<string, string>, requiredAttributeSlugs: string[]): boolean {
	for (const slug of requiredAttributeSlugs) {
		if (!selection[slug]) {
			return false;
		}
	}
	return true;
}

export function parsePdpSelectionFromSearch(search: { [key: string]: string | string[] | undefined }, categoryAttributeSlugs: string[]): Record<string, string> {
	const selection: Record<string, string> = {};
	for (const slug of categoryAttributeSlugs) {
		const raw = search[slug];
		if (typeof raw === "string" && raw.trim()) {
			selection[slug] = raw.trim();
		}
	}
	return selection;
}

export function selectionSignature(selection: Record<string, string>): string {
	return Object.entries(selection)
		.filter(([, value]) => value)
		.sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
		.map(([key, value]) => `${key}=${value}`)
		.join("&");
}

export function selectionToUrlPatch(selection: Record<string, string>, categoryAttributeSlugs: string[]): Record<string, string | null> {
	const patch: Record<string, string | null> = {};
	for (const slug of categoryAttributeSlugs) {
		patch[slug] = selection[slug] || null;
	}
	return patch;
}

export function hasPdpConfigurationInSearch(search: { [key: string]: string | string[] | undefined }, categoryAttributeSlugs: string[]): boolean {
	return categoryAttributeSlugs.some((slug) => typeof search[slug] === "string" && search[slug] !== "");
}

export function currentPdpSelectionSignature(search: { [key: string]: string | string[] | undefined }, categoryAttributeSlugs: string[]): string {
	return selectionSignature(parsePdpSelectionFromSearch(search, categoryAttributeSlugs));
}

export function resolveProductVariantFromSelection(product: Product, selection: Record<string, string>): Variant {
	return resolvePickerSelection(product.variants, selection).variant;
}

export function resolveProductVariantFromSearch(product: Product, search: { [key: string]: string | string[] | undefined }, categoryAttributeSlugs: string[]): Variant {
	const selection = parsePdpSelectionFromSearch(search, categoryAttributeSlugs);
	if (!hasPdpConfigurationInSearch(search, categoryAttributeSlugs)) {
		return getDefaultVariant(product);
	}
	return resolveProductVariantFromSelection(product, selection);
}

export function resolveExactVariantFromSearch(product: Product, search: { [key: string]: string | string[] | undefined }, categoryAttributeSlugs: string[]): Variant | null {
	if (!hasPdpConfigurationInSearch(search, categoryAttributeSlugs)) {
		return null;
	}
	const selection = parsePdpSelectionFromSearch(search, categoryAttributeSlugs);
	const requiredSlugs = getRequiredAttributeSlugsForProduct(product, categoryAttributeSlugs);
	if (!isPdpSelectionComplete(selection, requiredSlugs)) {
		return null;
	}
	return findVariantBySelection(product.variants, selection) ?? null;
}

export function categoryAttributeSlugsFromProduct(product: Product): string[] {
	const slugs = new Set<string>();
	for (const variant of product.variants) {
		for (const slug of Object.keys(variant.attributes ?? {})) {
			slugs.add(slug);
		}
	}
	return Array.from(slugs).sort((a, b) => a.localeCompare(b));
}

export function isReservedPdpParam(key: string): boolean {
	return RESERVED_PDP_PARAMS.has(key);
}
