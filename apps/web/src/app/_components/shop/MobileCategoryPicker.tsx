"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { classNames } from "@store/shared";
import { SelectSearchInput } from "@store/ui";

import { Icon } from "@/components/shared/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { categoryHref } from "@/lib/catalog/productPaths";
import type { CategoryMeta } from "@/lib/core/queries";

interface MobileCategoryPickerProps {
	activeSlug: string;
	categories: CategoryMeta[];
}

/** Compact mobile category switcher — one trigger opens a searchable bottom sheet list. */
export function MobileCategoryPicker({ activeSlug, categories }: MobileCategoryPickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const activeCategory = categories.find((category) => category.slug === activeSlug);

	const filteredCategories = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return categories;
		}
		return categories.filter((category) => category.label.toLowerCase().includes(normalizedQuery));
	}, [categories, query]);

	return (
		<>
			<div className="min-w-0 flex-1">
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="flex h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-ink-800)] transition-colors active:bg-[var(--color-canvas-deep)]"
					aria-haspopup="dialog"
					aria-expanded={isOpen}
				>
					{activeCategory ? <Icon node={activeCategory.iconNode} size={13} strokeWidth={2} className="shrink-0 text-[var(--color-ink-800)]" /> : null}
					<span className="min-w-0 truncate">{activeCategory?.label ?? "Category"}</span>
					<ChevronDown
						size={12}
						aria-hidden
						className={classNames("shrink-0 text-[var(--color-ink-500)] transition-transform duration-[var(--motion-slow)] ease-[var(--ease-out-quart)]", isOpen && "rotate-180")}
					/>
				</button>
			</div>

			<BottomSheet
				isOpen={isOpen}
				onClose={() => {
					setIsOpen(false);
					setQuery("");
				}}
				title="Choose a category"
				description="Switch the shop to a different catalog."
				height="auto"
			>
				<div className="mb-3">
					<SelectSearchInput value={query} onChange={setQuery} placeholder="Search categories…" />
				</div>
				<ul className="space-y-1.5">
					{filteredCategories.length === 0 ? (
						<li className="px-2 py-2 text-[12px] text-[var(--color-ink-500)]">No categories match your search.</li>
					) : (
						filteredCategories.map((category) => {
							const isActive = category.slug === activeSlug;
							const isAvailable = category.isActive;
							const inner = (
								<span
									className={classNames(
										"flex w-full min-w-0 items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
										isActive
											? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)] text-[var(--color-accent-900)]"
											: isAvailable
												? "border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-900)] active:bg-[var(--color-surface-muted)]"
												: "cursor-not-allowed border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/50 text-[var(--color-ink-500)]",
									)}
								>
									<span
										className={classNames(
											"grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)]",
											isActive ? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]" : "bg-[var(--color-accent-50)] text-[var(--color-accent-700)]",
										)}
									>
										<Icon node={category.iconNode} size={16} strokeWidth={2.2} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[13.5px] font-semibold leading-tight">{category.label}</span>
										{!isAvailable ? <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-500)]">Coming soon</span> : null}
									</span>
								</span>
							);

							return (
								<li key={category.slug}>
									{isAvailable ? (
										<Link
											href={categoryHref(category.slug)}
											scroll={false}
											onClick={() => {
												setIsOpen(false);
												setQuery("");
											}}
											aria-current={isActive ? "page" : undefined}
											className="block focus:outline-none"
										>
											{inner}
										</Link>
									) : (
										<span aria-disabled className="block">
											{inner}
										</span>
									)}
								</li>
							);
						})
					)}
				</ul>
			</BottomSheet>
		</>
	);
}

export function MobileCategoryPickerSkeleton() {
	return <Skeleton shape="pill" className="h-9 min-w-0 flex-1" />;
}
