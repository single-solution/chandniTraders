"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

import { classNames, formatPrice } from "@store/shared";

import { isPriceFilterActive, useAttributeFacets, useListingFilterMutations, type ShopFilterDataProps } from "@/components/shared/FilterSidebar";
import { FILTER_PARAM_KEYS } from "@/lib/core/filterParams";
import { useFilterParams } from "@/lib/core/useFilterParams";

interface ActiveFilterChip {
	key: string;
	label: string;
	onRemove: () => void;
}

interface ShopActiveFilterChipsProps extends ShopFilterDataProps {
	className?: string;
}

/** Removable chips for every active listing filter — visible without opening dropdowns. */
export function ShopActiveFilterChips({ categorySlug, brands = [], initialFacets = [], className }: ShopActiveFilterChipsProps) {
	const filterApi = useFilterParams();
	const { removeFromMulti, clearPrice, clearAll, params } = useListingFilterMutations(categorySlug);
	const { facets } = useAttributeFacets(categorySlug ?? "", params, initialFacets);

	const brandSlugs = filterApi.getMulti(FILTER_PARAM_KEYS.brands);
	const minPrice = filterApi.getSingle(FILTER_PARAM_KEYS.minPrice);
	const maxPrice = filterApi.getSingle(FILTER_PARAM_KEYS.maxPrice);

	const chips = useMemo(() => {
		if (!categorySlug) {
			return [];
		}

		const next: ActiveFilterChip[] = [];

		for (const brandSlug of brandSlugs) {
			const brand = brands.find((entry) => entry.slug === brandSlug);
			next.push({
				key: `brand:${brandSlug}`,
				label: brand?.name ?? brandSlug,
				onRemove: () => removeFromMulti(FILTER_PARAM_KEYS.brands, brandSlug),
			});
		}

		for (const key of Array.from(params.keys())) {
			if (!key.startsWith("attr.")) {
				continue;
			}
			const attributeSlug = key.slice(5);
			const facet = facets.find((entry) => entry.slug === attributeSlug);
			const values = filterApi.getMulti(key);
			for (const value of values) {
				const option = facet?.options.find((entry) => entry.value === value);
				const valueLabel = option?.label ?? value;
				const label = facet ? `${facet.label}: ${valueLabel}` : valueLabel;
				next.push({
					key: `${key}:${value}`,
					label,
					onRemove: () => removeFromMulti(key, value),
				});
			}
		}

		if (isPriceFilterActive(params)) {
			next.push({
				key: "price",
				label: formatPriceFilterLabel(minPrice, maxPrice),
				onRemove: clearPrice,
			});
		}

		return next;
	}, [brandSlugs, brands, categorySlug, clearPrice, facets, filterApi, maxPrice, minPrice, params, removeFromMulti]);

	if (chips.length === 0) {
		return null;
	}

	return (
		<div className={classNames("reveal flex flex-wrap items-center gap-2", className)} aria-label="Active filters">
			{chips.map((chip) => (
				<button
					key={chip.key}
					type="button"
					onClick={chip.onRemove}
					className="tap inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-ink-800)] hover:border-[var(--color-ink-300)]"
				>
					<span className="truncate">{chip.label}</span>
					<X size={12} aria-hidden />
				</button>
			))}
			<button
				type="button"
				onClick={clearAll}
				className="tap inline-flex h-7 items-center rounded-full px-2 text-[11px] font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"
			>
				Clear all
			</button>
		</div>
	);
}

function formatPriceFilterLabel(minPrice: string | undefined, maxPrice: string | undefined): string {
	const min = minPrice ? Number.parseInt(minPrice, 10) : undefined;
	const max = maxPrice ? Number.parseInt(maxPrice, 10) : undefined;
	if (min && max) {
		return `${formatPrice(min)} – ${formatPrice(max)}`;
	}
	if (min) {
		return `From ${formatPrice(min)}`;
	}
	if (max) {
		return `Up to ${formatPrice(max)}`;
	}
	return "Price";
}
