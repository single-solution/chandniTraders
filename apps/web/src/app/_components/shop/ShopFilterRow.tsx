"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check } from "lucide-react";

import { FilterDropdown } from "@/components/shared/FilterDropdown";

import {
	isPriceFilterActive,
	type ShopFilterDataProps,
} from "@/components/shared/FilterSidebar";

import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";
import { useAttributesForCategory } from "@/lib/core/storefrontReferenceContext";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

const SORT_OPTIONS = [
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: Low to High" },
	{ value: "price-desc", label: "Price: High to Low" },
	{ value: "name-asc", label: "Name: A to Z" },
];

export function ShopFilterRow({ categorySlug, brands = [], initialFacets }: ShopFilterDataProps) {
	const filterApi = useFilterParams();
	const params = filterApi.params;

	const currentSort = params.get(FILTER_PARAM_KEYS.sort) || "newest";
	const activeSortLabel = SORT_OPTIONS.find((opt) => opt.value === currentSort)?.label || "Sort";

	const minPriceParam = params.get(FILTER_PARAM_KEYS.minPrice) ?? "";
	const maxPriceParam = params.get(FILTER_PARAM_KEYS.maxPrice) ?? "";

	const [minPrice, setMinPrice] = useState(minPriceParam);
	const [maxPrice, setMaxPrice] = useState(maxPriceParam);

	const isPriceChanged = minPrice !== minPriceParam || maxPrice !== maxPriceParam;
	const hasPriceInput = minPrice !== "" || maxPrice !== "";
	const canApplyPrice = isPriceChanged && hasPriceInput;

	useEffect(() => {
		scheduleStateUpdate(() => {
			setMinPrice(minPriceParam);
			setMaxPrice(maxPriceParam);
		});
	}, [minPriceParam, maxPriceParam]);

	const handleMinPriceChange = (val: string) => {
		const newMin = val.replace(/[^0-9]/g, "");
		setMinPrice(newMin);
		
		// Auto-adjust max price if it's lower than the new min
		if (newMin && maxPrice && parseInt(maxPrice) <= parseInt(newMin)) {
			setMaxPrice((parseInt(newMin) + 1).toString());
		}
	};

	const handleMaxPriceChange = (val: string) => {
		const newMax = val.replace(/[^0-9]/g, "");
		setMaxPrice(newMax);
		
		// Auto-adjust min price if it's higher than the new max
		if (newMax && minPrice && parseInt(minPrice) >= parseInt(newMax)) {
			// Don't go below 0
			const adjustedMin = Math.max(0, parseInt(newMax) - 1);
			setMinPrice(adjustedMin.toString());
		}
	};

	const applyPriceRange = useCallback(() => {
		const next = new URLSearchParams(params.toString());
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
		filterApi.replaceParams(next);
	}, [filterApi, maxPrice, minPrice, params]);

	return (
		<div className="flex min-w-0 items-center gap-2 max-md:w-full">
			<FilterDropdown 
				label={`Sort by: ${activeSortLabel}`} 
				activeCount={currentSort !== "newest" ? 1 : 0}
				className="max-md:flex-1"
				triggerClassName="!bg-[var(--color-accent-500)] !text-[var(--color-ink-900)] !border-[var(--color-accent-600)] max-md:w-full max-md:justify-center"
			>
				<div className="flex flex-col gap-1 p-1">
					{SORT_OPTIONS.map((option) => {
						const isActive = currentSort === option.value;
						return (
							<button
								key={option.value}
								type="button"
								onClick={() => {
									const next = new URLSearchParams(params.toString());
									if (option.value === "newest") {
										next.delete(FILTER_PARAM_KEYS.sort);
									} else {
										next.set(FILTER_PARAM_KEYS.sort, option.value);
									}
									filterApi.replaceParams(next);
								}}
								className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
									isActive ? "bg-[var(--color-accent-50)] text-[var(--color-accent-900)] font-medium" : "hover:bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]"
								}`}
							>
								{option.label}
								{isActive && <Check size={16} className="text-[var(--color-accent-600)]" />}
							</button>
						);
					})}
				</div>
			</FilterDropdown>

			<FilterDropdown
				label="Price"
				activeCount={minPriceParam || maxPriceParam ? 1 : 0}
				className="max-md:flex-1"
				triggerClassName="!bg-[var(--color-accent-500)] !text-[var(--color-ink-900)] !border-[var(--color-accent-600)] max-md:w-full max-md:justify-center"
			>
				<div className="flex flex-col gap-3 p-3 min-w-[200px]">
					<div className="flex items-center gap-2">
						<div className="flex-1">
							<label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-1 block">Min</label>
							<input
								type="number"
								inputMode="numeric"
								min={0}
								value={minPrice}
								placeholder="0"
								onChange={(e) => handleMinPriceChange(e.target.value)}
								className="h-9 w-full rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-0 text-[13px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-500)]"
							/>
						</div>
						<span className="text-[var(--color-ink-400)] mt-4">–</span>
						<div className="flex-1">
							<label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-1 block">Max</label>
							<input
								type="number"
								inputMode="numeric"
								min={minPrice ? parseInt(minPrice) + 1 : 0}
								value={maxPrice}
								placeholder="Any"
								onChange={(e) => handleMaxPriceChange(e.target.value)}
								className="h-9 w-full rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-0 text-[13px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-500)]"
							/>
						</div>
					</div>
					<button
						type="button"
						onClick={applyPriceRange}
						disabled={!canApplyPrice && !(!minPrice && !maxPrice && (minPriceParam || maxPriceParam))}
						className={`mt-1 flex w-full items-center justify-center rounded-md py-2 text-[13px] font-semibold transition-colors ${
							canApplyPrice || (!minPrice && !maxPrice && (minPriceParam || maxPriceParam))
								? "bg-[var(--color-ink-900)] text-white hover:bg-[var(--color-ink-800)]"
								: "bg-[var(--color-ink-100)] text-[var(--color-ink-400)] cursor-not-allowed"
						}`}
					>
						Apply
					</button>
				</div>
			</FilterDropdown>
		</div>
	);
}
