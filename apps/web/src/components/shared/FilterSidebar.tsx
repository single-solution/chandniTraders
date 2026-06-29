"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { attributeSlugsToClearOnFilterChange, classNames, compareAlphabetically, type Brand } from "@store/shared";
import type { AttributeFacet } from "@/lib/core/facets";

import { Button } from "@store/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilterCheckboxList } from "@/components/shared/FilterCheckboxList";
import { Input } from "@/components/ui/Input";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { useAttributesForCategory } from "@/lib/core/storefrontReferenceContext";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) return false;
	const set = new Set(left);
	for (const value of right) {
		if (!set.has(value)) return false;
	}
	return true;
}

/**
 * Filter sidebar — brand and attribute facets. Sort UI removed; server defaults to newest.
 */

interface FilterSidebarProps {
	/** Active category slug — drives which attributes render. `undefined` = all. */
	categorySlug?: string;
	/** Live brand list from the DB, with product counts. */
	brands?: Brand[];
	/** Server-rendered facets for the current URL (avoids empty first paint). */
	initialFacets?: AttributeFacet[];
}

export type FilterPanelSection = "brand" | "attributes" | "price";

export interface FilterPanelProps {
	isMobile?: boolean;
	categorySlug?: string;
	brands: Brand[];
	initialFacets: AttributeFacet[];
	/** When set, only render these groups (used by shop filter dropdown rows). */
	sections?: FilterPanelSection[];
	/** Limits the attributes section to one facet axis (per-axis dropdowns). */
	attributeSlug?: string;
	/** Multi-column layout for attribute groups (More filters grid menu). */
	attributesLayout?: "stack" | "grid";
	/** `plain` drops the sticky sidebar chrome — for popover panels. */
	layout?: "sidebar" | "plain";
	showClearAll?: boolean;
}

export type ShopFilterDataProps = Pick<FilterSidebarProps, "categorySlug" | "brands" | "initialFacets">;

export function FilterSidebar({ categorySlug, brands = [], initialFacets = [] }: FilterSidebarProps) {
	const [isMobileOpen, setIsMobileOpen] = useState(false);
	const filterApi = useFilterParams();
	const activeFilterCount = countActiveFilters(filterApi.params);

	return (
		<>
			<div className="flex-1 md:hidden">
				<button
					type="button"
					onClick={() => setIsMobileOpen(true)}
					className={classNames(
						"flex h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors active:bg-[var(--color-canvas-deep)]",
						activeFilterCount > 0
							? "border-[var(--color-accent-400)]/70 bg-[var(--color-accent-50)]/90 text-[var(--color-accent-900)]"
							: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-800)]",
					)}
				>
					<SlidersHorizontal size={13} />
					Filters
					{activeFilterCount > 0 && (
						<span className="ml-0.5 grid size-4 place-items-center rounded-full bg-[var(--color-accent-500)] text-[10px] font-bold text-[var(--color-ink-900)]">
							{activeFilterCount}
						</span>
					)}
					<ChevronDown
						size={12}
						aria-hidden
						className={classNames(
							"shrink-0 text-[var(--color-ink-500)] transition-transform duration-[var(--motion-slow)] ease-[var(--ease-out-quart)]",
							isMobileOpen && "rotate-180",
						)}
					/>
				</button>
			</div>

			<aside className="hidden md:sticky md:top-[calc(var(--desktop-header-h)+24px)] md:block md:h-[calc(100dvh-var(--desktop-header-h)-48px)]">
				<FilterPanel categorySlug={categorySlug} brands={brands} initialFacets={initialFacets} />
			</aside>

			<BottomSheet
				isOpen={isMobileOpen}
				onClose={() => setIsMobileOpen(false)}
				title="Filter & sort"
				description="Narrow down by price and product specs."
				height="lg"
				footer={
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="md"
							className="flex-1"
							onClick={() => {
								filterApi.clearAll();
							}}
						>
							Clear all
						</Button>
						<Button variant="primary" size="md" className="flex-[2]" onClick={() => setIsMobileOpen(false)}>
							Show results
						</Button>
					</div>
				}
			>
				<FilterPanel categorySlug={categorySlug} brands={brands} initialFacets={initialFacets} isMobile />
			</BottomSheet>
		</>
	);
}

interface FilterPanelPropsInternal extends FilterPanelProps {}

export function FilterPanel({
	isMobile = false,
	categorySlug,
	brands,
	initialFacets,
	sections,
	attributeSlug,
	attributesLayout = "stack",
	layout = "sidebar",
	showClearAll,
}: FilterPanelPropsInternal) {
	const activeSections = sections ?? (["attributes", "price"] as FilterPanelSection[]);
	const includeBrand = activeSections.includes("brand");
	const includeAttributes = activeSections.includes("attributes");
	const includePrice = activeSections.includes("price");
	const shouldShowClearAll = showClearAll ?? (!isMobile && layout === "sidebar");
	const isCompactPanel = layout === "plain";
	const filterApi = useFilterParams();
	const router = useRouter();
	const pathname = usePathname();
	const { startNavigation } = useNavigationTransition();
	const categoryAttributes = useAttributesForCategory(categorySlug ?? "");
	const attributeNodes = useMemo(
		() =>
			categoryAttributes.map((attribute) => ({
				slug: attribute.slug,
				label: attribute.label,
				visibility: attribute.visibility ?? { type: "always" as const },
			})),
		[categoryAttributes],
	);

	const facetFetchKey = `${categorySlug ?? ""}:${filterApi.params.toString()}`;

	// Raw URL strings — stable primitives we can use as effect deps without
	// triggering a re-fire on every render (which `filterApi.getMulti` would,
	// since it returns a fresh array each call).
	const urlBrandSlugsRaw = filterApi.params.get(FILTER_PARAM_KEYS.brands) ?? "";
	const minPriceParam = filterApi.getSingle(FILTER_PARAM_KEYS.minPrice) ?? "";
	const maxPriceParam = filterApi.getSingle(FILTER_PARAM_KEYS.maxPrice) ?? "";

	const splitCsv = useCallback(
		(raw: string) =>
			raw
				.split(",")
				.map((token) => token.trim())
				.filter(Boolean),
		[],
	);

	// Optimistic mirrors of the URL-driven selections so the checkbox flip is
	// immediate on tap. `router.replace` + RSC settle on their own time — when
	// the URL eventually catches up (or changes from a back/forward) the effect
	// below snaps the mirror back into sync.
	//
	// Effect deps are the RAW URL strings, NOT the parsed arrays. If we depended
	// on the parsed arrays (fresh on every render) the effect would fire after
	// every optimistic update and revert it.
	const [optimisticBrandSlugs, setOptimisticBrandSlugs] = useState(() => splitCsv(urlBrandSlugsRaw));

	useEffect(() => {
		scheduleStateUpdate(() => setOptimisticBrandSlugs(splitCsv(urlBrandSlugsRaw)));
	}, [urlBrandSlugsRaw, splitCsv]);

	const brandSlugs = optimisticBrandSlugs;

	const [minPrice, setMinPrice] = useState(minPriceParam);
	const [maxPrice, setMaxPrice] = useState(maxPriceParam);

	const clearDependentAttributes = useCallback(
		(next: URLSearchParams, changed: "brand" | string) => {
			for (const slug of attributeSlugsToClearOnFilterChange(attributeNodes, changed)) {
				next.delete(`attr.${slug}`);
			}
		},
		[attributeNodes],
	);

	const toggleBrand = useCallback(
		(slug: string) => {
			const set = new Set(optimisticBrandSlugs);
			if (set.has(slug)) {
				set.delete(slug);
			} else {
				set.add(slug);
			}
			const nextSlugs = Array.from(set);
			setOptimisticBrandSlugs(nextSlugs);

			const next = new URLSearchParams(filterApi.params.toString());
			if (nextSlugs.length === 0) {
				next.delete(FILTER_PARAM_KEYS.brands);
			} else {
				next.set(FILTER_PARAM_KEYS.brands, nextSlugs.join(","));
			}
			clearDependentAttributes(next, "brand");
			filterApi.replaceParams(next);
		},
		[clearDependentAttributes, filterApi, optimisticBrandSlugs],
	);

	// Optimistic per-attribute selections — keyed by attribute slug → array of
	// selected values. Same shape and update story as the brands mirror
	// above; the FilterCheckRow inside `AttributeFacetGroups` reads from this
	// override map so taps flip the check instantly.
	const [optimisticAttributes, setOptimisticAttributes] = useState<Record<string, string[]>>({});

	// Drop an attribute's optimistic override the moment the URL settles on the
	// same value. Deps: ONLY `filterApi.params` (the stable underlying signal)
	// — including `optimisticAttributes` would revert overrides mid-flight.
	const filterParams = filterApi.params;
	useEffect(() => {
		scheduleStateUpdate(() => {
			setOptimisticAttributes((prev) => {
				const overridden = Object.keys(prev);
				if (overridden.length === 0) return prev;
				let changed = false;
				const next: Record<string, string[]> = { ...prev };
				for (const slug of overridden) {
					const raw = filterParams.get(`attr.${slug}`) ?? "";
					const urlValues = splitCsv(raw);
					if (sameStringSet(urlValues, prev[slug] ?? [])) {
						delete next[slug];
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		});
	}, [filterParams, splitCsv]);

	const toggleAttribute = useCallback(
		(attributeSlug: string, value: string) => {
			const paramKey = `attr.${attributeSlug}`;
			const current = optimisticAttributes[attributeSlug] ?? filterApi.getMulti(paramKey);
			const set = new Set(current);
			if (set.has(value)) {
				set.delete(value);
			} else {
				set.add(value);
			}
			const nextValues = Array.from(set);
			setOptimisticAttributes((prev) => ({ ...prev, [attributeSlug]: nextValues }));

			const next = new URLSearchParams(filterApi.params.toString());
			if (nextValues.length === 0) {
				next.delete(paramKey);
			} else {
				next.set(paramKey, nextValues.join(","));
			}
			clearDependentAttributes(next, attributeSlug);
			filterApi.replaceParams(next);
		},
		[clearDependentAttributes, filterApi, optimisticAttributes],
	);

	const sortedBrands = useMemo(() => {
		const selected = new Set(brandSlugs);
		return [...brands].filter((brand) => brand.productCount > 0 || selected.has(brand.slug)).sort((left, right) => compareAlphabetically(left.name, right.name));
	}, [brands, brandSlugs]);

	const applyPriceRange = () => {
		const next = new URLSearchParams(filterApi.params.toString());
		if (minPrice) {
			next.set(FILTER_PARAM_KEYS.minPrice, minPrice);
		} else {
			next.delete(FILTER_PARAM_KEYS.minPrice);
		}
		if (maxPrice) {
			next.set(FILTER_PARAM_KEYS.maxPrice, maxPrice);
		} else {
			next.delete(FILTER_PARAM_KEYS.maxPrice);
		}
		next.delete(FILTER_PARAM_KEYS.page);
		const queryString = next.toString();
		const url = queryString ? `${pathname}?${queryString}` : pathname;
		startNavigation(() => {
			router.replace(url, { scroll: false });
		});
	};

	const filterGroups = (
		<div className={isMobile ? "sheet-stagger space-y-6" : "space-y-3 p-0"}>
			{includeBrand ? (
				<>
					<FilterGroup title="Brand" reveal={!isMobile && layout === "sidebar"}>
						{sortedBrands.length === 0 ? (
							<p className="px-2 text-[12px] text-[var(--color-ink-500)]">No brands available yet.</p>
						) : (
							<FilterCheckboxList
								options={sortedBrands.map((brand) => ({
									value: brand.slug,
									label: brand.name,
									count: brand.productCount,
								}))}
								selected={brandSlugs}
								onToggle={toggleBrand}
								compact={isCompactPanel}
							/>
						)}
					</FilterGroup>
					{includeAttributes && layout === "sidebar" ? <FilterDivider /> : null}
				</>
			) : null}

			{includeAttributes && categorySlug ? (
				<div className={layout === "sidebar" && !isMobile ? "reveal" : undefined}>
					<AttributeFacetGroups
						key={facetFetchKey}
						categorySlug={categorySlug}
						initialFacets={initialFacets}
						filterParams={filterApi.params}
						getMulti={(key) => {
							const attrSlug = key.startsWith("attr.") ? key.slice(5) : null;
							if (attrSlug && optimisticAttributes[attrSlug]) {
								return optimisticAttributes[attrSlug];
							}
							return filterApi.getMulti(key);
						}}
						onToggleAttribute={toggleAttribute}
						hideDividers={layout === "plain" || attributesLayout === "grid"}
						onlySlug={attributeSlug}
						compact={isCompactPanel}
						groupLayout={attributesLayout}
					/>
				</div>
			) : null}

			{shouldShowClearAll && countActiveFilters(filterApi.params) > 0 ? (
				<div className="pt-1">
					<button
						type="button"
						onClick={() => filterApi.clearAll()}
						className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-ink-700)] hover:border-[var(--color-ink-300)]"
					>
						<X size={12} />
						Clear all filters
					</button>
				</div>
			) : null}
		</div>
	);

	const priceFooter = includePrice ? (
		<div className={isMobile ? "mt-6 border-t border-[var(--color-ink-100)] pt-4" : layout === "sidebar" ? "border-t border-[var(--color-ink-100)] p-2.5" : "pt-1"}>
			<FilterGroup title={layout === "plain" && !isMobile ? undefined : "Price"}>
				<div className="min-w-0 space-y-2">
					<div className="flex min-w-0 w-full items-center gap-2">
						<PriceInput value={minPrice} onChange={setMinPrice} placeholder="Min" ariaLabel="Minimum price in rupees" />
						<span aria-hidden className="text-[var(--color-ink-300)]">
							–
						</span>
						<PriceInput value={maxPrice} onChange={setMaxPrice} placeholder="Max" ariaLabel="Maximum price in rupees" />
					</div>
					<button
						type="button"
						onClick={applyPriceRange}
						className={classNames(
							"inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent-500)] font-medium text-[var(--color-ink-900)] transition-colors hover:bg-[var(--color-accent-600)]",
							isCompactPanel ? "h-8 text-[12px]" : "h-9 text-[13px]",
						)}
					>
						<Check size={isCompactPanel ? 12 : 14} strokeWidth={2.6} />
						Apply
					</button>
				</div>
			</FilterGroup>
		</div>
	) : null;

	if (isMobile) {
		return (
			<>
				{filterGroups}
				{priceFooter}
			</>
		);
	}

	if (layout === "plain") {
		return (
			<div className="space-y-3">
				{filterGroups}
				{priceFooter}
			</div>
		);
	}

	return (
		/* Concentric: inner FilterCheckRow --radius-md (8) sits ~10px
       from sidebar edge → outer 18 ≈ --radius-xl (20, within 2px). */
		<div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-accent-200)]/45 bg-[var(--color-surface)]">
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 pb-3">
				<div className="reveal-stagger space-y-3">{filterGroups}</div>
			</div>
			{priceFooter ? <div className="shrink-0 bg-[var(--color-surface)]">{priceFooter}</div> : null}
		</div>
	);
}

interface AttributeFacetGroupsProps {
	categorySlug: string;
	initialFacets: AttributeFacet[];
	filterParams: URLSearchParams;
	getMulti: (key: string) => string[];
	onToggleAttribute: (attributeSlug: string, value: string) => void;
	hideDividers?: boolean;
	/** When set, render only this attribute slug (per-axis dropdown). */
	onlySlug?: string;
	compact?: boolean;
	groupLayout?: "stack" | "grid";
}

/** Live attribute facets for the active category + current URL filters. */
export function useAttributeFacets(categorySlug: string, filterParams: URLSearchParams, initialFacets: AttributeFacet[]) {
	const [facets, setFacets] = useState<AttributeFacet[]>(initialFacets);
	const [facetsLoading, setFacetsLoading] = useState(true);

	useEffect(() => {
		const controller = new AbortController();
		const query = new URLSearchParams(filterParams.toString());
		query.set("category", categorySlug);
		fetch(`/api/facets?${query.toString()}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Facets request failed");
				}
				const payload = (await response.json()) as {
					facets?: AttributeFacet[];
				};
				setFacets(payload.facets ?? []);
			})
			.catch((error) => {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
				setFacets([]);
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setFacetsLoading(false);
				}
			});
		return () => controller.abort();
	}, [categorySlug, filterParams]);

	return { facets, facetsLoading };
}

/** Remount when category/filters change so facet state resets without sync effects. */
function AttributeFacetGroups({
	categorySlug,
	initialFacets,
	filterParams,
	getMulti,
	onToggleAttribute,
	hideDividers = false,
	onlySlug,
	compact = false,
	groupLayout = "stack",
}: AttributeFacetGroupsProps) {
	const { facets, facetsLoading } = useAttributeFacets(categorySlug, filterParams, initialFacets);

	if (!facetsLoading && facets.length === 0) {
		return (
			<p className="max-w-prose px-2 text-[12px] leading-snug text-[var(--color-ink-500)]">
				No more products match your selection. Adjust or clear filters to see attribute options.
			</p>
		);
	}

	const visibleFacets = onlySlug ? facets.filter((facet) => facet.slug === onlySlug) : facets;

	const renderFacetGroup = (facet: (typeof visibleFacets)[number]) => {
		const selectedValues = getMulti(`attr.${facet.slug}`);
		return (
			<FilterGroup title={onlySlug ? undefined : facet.label}>
				{facetsLoading && facet.options.length === 0 ? (
					<p className="px-2 text-[12px] text-[var(--color-ink-500)]">Loading options…</p>
				) : facet.options.length === 0 ? (
					<p className="px-2 text-[12px] text-[var(--color-ink-500)]">No values in current results.</p>
				) : (
					<FilterCheckboxList
						options={facet.options.map((option) => ({
							value: option.value,
							label: option.label,
							count: option.count,
						}))}
						selected={selectedValues}
						onToggle={(value) => onToggleAttribute(facet.slug, value)}
						compact={compact}
					/>
				)}
			</FilterGroup>
		);
	};

	if (groupLayout === "grid") {
		return (
			<div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
				{visibleFacets.map((facet) => (
					<div key={facet.slug} className="min-w-0">
						{renderFacetGroup(facet)}
					</div>
				))}
			</div>
		);
	}

	return (
		<>
			{visibleFacets.map((facet, attributeIndex) => {
				return (
					<div key={facet.slug}>
						{renderFacetGroup(facet)}
						{!hideDividers && attributeIndex < visibleFacets.length - 1 ? <FilterDivider /> : null}
					</div>
				);
			})}
		</>
	);
}

/** Quick count of how many filter groups are currently set. */
export function countActiveFilters(params: URLSearchParams): number {
	let activeCount = 0;
	for (const key of Object.values(FILTER_PARAM_KEYS)) {
		if (key === FILTER_PARAM_KEYS.sort || key === FILTER_PARAM_KEYS.page || key === FILTER_PARAM_KEYS.search) {
			continue;
		}
		if (params.get(key)) {
			activeCount += 1;
		}
	}
	for (const key of Array.from(params.keys())) {
		if (key.startsWith("attr.") && params.get(key)) {
			activeCount += 1;
		}
	}
	return activeCount;
}

/** Count comma-separated values for a single URL param key. */
export function countMultiParam(params: URLSearchParams, key: string): number {
	const raw = params.get(key);
	if (!raw) {
		return 0;
	}
	return raw
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean).length;
}

/** Count attribute axes with at least one selected value. */
export function countActiveAttributeFilters(params: URLSearchParams): number {
	let activeCount = 0;
	for (const key of Array.from(params.keys())) {
		if (key.startsWith("attr.") && params.get(key)) {
			activeCount += 1;
		}
	}
	return activeCount;
}

/** More filters unlock after brand selection, or when attrs are already set. */
export function shouldShowMoreAttributeFilters(params: URLSearchParams, categoryAttributes: Array<{ visibility?: { type?: string } }>): boolean {
	if (countActiveAttributeFilters(params) > 0) {
		return true;
	}
	if (categoryAttributes.length === 0) {
		return false;
	}
	const hasBrand = countMultiParam(params, FILTER_PARAM_KEYS.brands) > 0;
	if (hasBrand) {
		return true;
	}
	return categoryAttributes.some((attribute) => (attribute.visibility?.type ?? "always") === "always");
}

export function isPriceFilterActive(params: URLSearchParams): boolean {
	return Boolean(params.get(FILTER_PARAM_KEYS.minPrice) || params.get(FILTER_PARAM_KEYS.maxPrice));
}

/** Remove one value from a multi URL param; clears dependent attribute filters when needed. */
export function useListingFilterMutations(categorySlug?: string) {
	const filterApi = useFilterParams();
	const categoryAttributes = useAttributesForCategory(categorySlug ?? "");
	const attributeNodes = useMemo(
		() =>
			categoryAttributes.map((attribute) => ({
				slug: attribute.slug,
				label: attribute.label,
				visibility: attribute.visibility ?? { type: "always" as const },
			})),
		[categoryAttributes],
	);

	const clearDependentAttributes = useCallback(
		(next: URLSearchParams, changed: "brand" | string) => {
			for (const slug of attributeSlugsToClearOnFilterChange(attributeNodes, changed)) {
				next.delete(`attr.${slug}`);
			}
		},
		[attributeNodes],
	);

	const removeFromMulti = useCallback(
		(paramKey: string, value: string) => {
			const next = new URLSearchParams(filterApi.params.toString());
			const current = filterApi.getMulti(paramKey);
			const set = new Set(current);
			set.delete(value);
			const nextValues = Array.from(set);
			if (nextValues.length === 0) {
				next.delete(paramKey);
			} else {
				next.set(paramKey, nextValues.join(","));
			}
			if (paramKey === FILTER_PARAM_KEYS.brands) {
				clearDependentAttributes(next, "brand");
			} else if (paramKey.startsWith("attr.")) {
				clearDependentAttributes(next, paramKey.slice(5));
			}
			filterApi.replaceParams(next);
		},
		[clearDependentAttributes, filterApi],
	);

	const clearPrice = useCallback(() => {
		const next = new URLSearchParams(filterApi.params.toString());
		next.delete(FILTER_PARAM_KEYS.minPrice);
		next.delete(FILTER_PARAM_KEYS.maxPrice);
		filterApi.replaceParams(next);
	}, [filterApi]);

	const clearAll = filterApi.clearAll;

	return { removeFromMulti, clearPrice, clearAll, params: filterApi.params };
}

interface FilterGroupProps {
	title?: string;
	children: React.ReactNode;
	/** Desktop-only scroll reveal. Off on mobile, where `sheet-stagger` drives entrance. */
	reveal?: boolean;
}

function FilterGroup({ title, children, reveal = false }: FilterGroupProps) {
	return (
		<div className={classNames("space-y-3", reveal && "reveal")}>
			{title ? <h3 className="px-1 text-[12.5px] font-bold tracking-wide text-[var(--color-ink-900)]">{title}</h3> : null}
			{children}
		</div>
	);
}

function FilterDivider() {
	return <div className="h-px bg-[var(--color-ink-100)]" />;
}

interface PriceInputProps {
	value: string;
	onChange: (next: string) => void;
	placeholder: string;
	ariaLabel: string;
}

function PriceInput({ value, onChange, placeholder, ariaLabel }: PriceInputProps) {
	return (
		<div className="min-w-0 flex-1">
			<Input
				type="number"
				inputMode="numeric"
				min={0}
				value={value}
				aria-label={ariaLabel}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
				inputSize="sm"
			/>
		</div>
	);
}
