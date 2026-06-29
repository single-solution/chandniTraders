"use client";

/**
 * Categories workspace — responsive grid of category cards with inline brands and attributes.
 */

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Sparkles, Tag, Trash2 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@store/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WorkspacePrimaryAction } from "@/components/shared/workspaceUi";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";

import { AttributeEditor } from "./AttributeEditor";
import { BrandEditor } from "./BrandEditor";
import { CatalogVisibilityToggle } from "./CatalogVisibilityToggle";
import { CategoryEditor } from "./CategoryEditor";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import { StructuredContentFullPreview } from "@/components/forms/StructuredContentRenderer";

interface CategoriesWorkspaceProps {
	initialCategories: AdminCategory[];
	initialBrands: AdminBrand[];
	initialAttributes: AdminAttribute[];
	visibleSections?: CatalogSection[];
	/** Renders inside the catalog workspace (no extra page chrome). */
	embedded?: boolean;
}

type CatalogSection = "brands" | "attributes";

const ALL_CATALOG_SECTIONS: CatalogSection[] = ["brands", "attributes"];

function catalogEntityKey(items: { id: string }[]): string {
	return items.map((item) => item.id).join("\0");
}

type DrawerKind =
	| { kind: "category"; category: AdminCategory | null }
	| { kind: "brand"; category: AdminCategory; brand: AdminBrand | null }
	| {
			kind: "attribute";
			category: AdminCategory;
			attribute: AdminAttribute | null;
	  }
	| null;

interface DeleteIntent {
	kind: "category" | "brand" | "attribute";
	id: string;
	label: string;
	/** For brands deleted from a single category (unlink instead of full delete). */
	unlinkFromCategorySlug?: string;
}

function getWorkspaceCopy(visibleSections: CatalogSection[]) {
	if (visibleSections.length === 0) {
		return {
			countLabel: (count: number) => `${count} categor${count === 1 ? "y" : "ies"}`,
			description: "Edit storefront category tiles — description, bullets, icon, and SEO.",
		};
	}
	if (visibleSections.length === 1 && visibleSections[0] === "brands") {
		return {
			countLabel: (count: number) => `${count} brand workspaces`,
			description: "Manage brands under their categories. Category cards only show brands on this page.",
		};
	}
	if (visibleSections.length === 1 && visibleSections[0] === "attributes") {
		return {
			countLabel: (count: number) => `${count} attribute workspaces`,
			description: "Manage attributes under their categories. Brand rows are hidden here.",
		};
	}
	return {
		countLabel: (count: number) => `${count} categories`,
		description: "Each category owns its brands and attributes. Authoring here propagates straight to the storefront.",
	};
}

export function Categories({
	initialCategories,
	initialBrands,
	initialAttributes,
	visibleSections = ALL_CATALOG_SECTIONS,
	embedded = false,
}: CategoriesWorkspaceProps) {
	const toast = useToast();
	const initialCategoriesKey = useMemo(() => catalogEntityKey(initialCategories), [initialCategories]);
	const initialBrandsKey = useMemo(() => catalogEntityKey(initialBrands), [initialBrands]);
	const initialAttributesKey = useMemo(() => catalogEntityKey(initialAttributes), [initialAttributes]);

	const [categories, setCategories] = useState(initialCategories);
	const [categoriesSeedKey, setCategoriesSeedKey] = useState(initialCategoriesKey);
	if (categoriesSeedKey !== initialCategoriesKey) {
		setCategoriesSeedKey(initialCategoriesKey);
		setCategories(initialCategories);
	}

	const [brands, setBrands] = useState(initialBrands);
	const [brandsSeedKey, setBrandsSeedKey] = useState(initialBrandsKey);
	if (brandsSeedKey !== initialBrandsKey) {
		setBrandsSeedKey(initialBrandsKey);
		setBrands(initialBrands);
	}

	const [attributes, setAttributes] = useState(initialAttributes);
	const [attributesSeedKey, setAttributesSeedKey] = useState(initialAttributesKey);
	if (attributesSeedKey !== initialAttributesKey) {
		setAttributesSeedKey(initialAttributesKey);
		setAttributes(initialAttributes);
	}

	const [drawer, setDrawer] = useState<DrawerKind>(null);
	const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const refreshAll = useCallback(async () => {
		setRefreshing(true);
		try {
			const [cats, brs, attrs] = await Promise.all([
				apiFetch<{ items: AdminCategory[] }>("/api/categories?limit=100"),
				apiFetch<{ items: AdminBrand[] }>("/api/brands?limit=200"),
				apiFetch<{ items: AdminAttribute[] }>("/api/attributes?limit=100"),
			]);
			setCategories(cats.items);
			setBrands(brs.items);
			setAttributes(attrs.items);
		} catch (error) {
			const message = error instanceof ApiError ? error.message : "Failed to refresh categories.";
			toast.danger(message);
		} finally {
			setRefreshing(false);
		}
	}, [toast]);

	const visibleSectionSet = useMemo(() => new Set<CatalogSection>(visibleSections), [visibleSections]);
	const canManageCategories = visibleSections.length === 0;

	const grouped = useMemo(() => {
		return categories.map((category) => ({
			category,
			brands: brands.filter((brand) => brand.categorySlugs.includes(category.slug)),
			attributes: attributes.filter((attr) => attr.categorySlug === category.slug).sort((left, right) => left.label.localeCompare(right.label)),
		}));
	}, [categories, brands, attributes]);

	const workspaceCopy = getWorkspaceCopy(visibleSections);

	async function handleConfirmDelete() {
		if (!deleteIntent) return;
		const { kind, id, label, unlinkFromCategorySlug } = deleteIntent;
		setDeleteIntent(null);
		try {
			if (kind === "brand" && unlinkFromCategorySlug) {
				const brand = brands.find((b) => b.id === id);
				if (!brand) return;
				const nextSlugs = brand.categorySlugs.filter((slug) => slug !== unlinkFromCategorySlug);
				if (nextSlugs.length === 0) {
					await apiFetch(`/api/brands/${id}`, { method: "DELETE" });
				} else {
					await apiFetch<AdminBrand>(`/api/brands/${id}`, {
						method: "PUT",
						json: { categorySlugs: nextSlugs },
					});
				}
				toast.success(`Removed brand "${label}".`);
			} else {
				const path = kind === "category" ? `/api/categories/${id}` : kind === "brand" ? `/api/brands/${id}` : `/api/attributes/${id}`;
				await apiFetch(path, { method: "DELETE" });
				toast.success(`Deleted ${kind} "${label}".`);
			}
			await refreshAll();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : `Failed to delete ${kind}.`;
			toast.danger(message);
		}
	}

	async function moveCategory(category: AdminCategory, direction: -1 | 1) {
		const currentIndex = categories.findIndex((item) => item.id === category.id);
		if (currentIndex === -1) {
			return;
		}
		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= categories.length) {
			return;
		}
		const reorderedCategories = [...categories];
		const [movedCategory] = reorderedCategories.splice(currentIndex, 1);
		if (!movedCategory) {
			return;
		}
		reorderedCategories.splice(nextIndex, 0, movedCategory);
		try {
			await Promise.all(
				reorderedCategories.map((item, index) =>
					apiFetch<AdminCategory>(`/api/categories/${item.id}`, {
						method: "PUT",
						json: { sortOrder: index },
					}),
				),
			);
			await refreshAll();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : "Failed to reorder category.";
			toast.danger(message);
		}
	}

	return (
		<>
			<header className={embedded ? "reveal mb-3 flex flex-wrap items-end justify-between gap-2" : "reveal flex flex-wrap items-end justify-between gap-3"}>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
						{refreshing ? "Syncing…" : workspaceCopy.countLabel(categories.length)}
					</p>
					<p className={embedded ? "mt-0.5 max-w-prose text-[11px] text-[var(--color-ink-600)]" : "mt-1 max-w-prose text-[13px] text-[var(--color-ink-600)]"}>
						{workspaceCopy.description}
					</p>
				</div>
				{canManageCategories && <WorkspacePrimaryAction label="New category" iconElement={<Plus size={14} />} onClick={() => setDrawer({ kind: "category", category: null })} />}
			</header>

			{grouped.length === 0 ? (
				<div
					className={
						embedded
							? "reveal rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-6 py-12 text-center"
							: "reveal mt-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-surface-muted)] px-6 py-16 text-center"
					}
				>
					<Sparkles size={26} className="mx-auto text-[var(--color-accent-600)]" aria-hidden />
					<p className="mt-3 text-[15px] font-semibold text-[var(--color-ink-900)]">{canManageCategories ? "Create your first category" : "No categories yet"}</p>
					<p className="mx-auto mt-1 max-w-prose text-[13px] text-[var(--color-ink-600)]">
						{canManageCategories
							? "Add a category tile for the storefront home grid and shop navigation."
							: "Create categories from the Categories page first, then manage this page's content under each category."}
					</p>
					{canManageCategories && (
						<div className="mt-5 flex justify-center">
							<Button type="button" variant="primary" size="md" leadingIcon={<Plus size={14} />} onClick={() => setDrawer({ kind: "category", category: null })}>
								Create category
							</Button>
						</div>
					)}
				</div>
			) : (
				<ul
					className={
						embedded
							? "reveal-stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
							: "reveal-stagger mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
					}
				>
					{grouped.map(({ category, brands: brandsForCategory, attributes: attrsForCategory }, index) => (
						<li key={category.id} className="reveal h-full">
							<CategoryCard
								category={category}
								brands={brandsForCategory}
								attributes={attrsForCategory}
								visibleSections={visibleSectionSet}
								canManageCategories={canManageCategories}
								isFirst={index === 0}
								isLast={index === grouped.length - 1}
								onEditCategory={() => setDrawer({ kind: "category", category })}
								onDeleteCategory={() =>
									setDeleteIntent({
										kind: "category",
										id: category.id,
										label: category.label,
									})
								}
								onMoveUp={() => moveCategory(category, -1)}
								onMoveDown={() => moveCategory(category, 1)}
								onAddBrand={() => setDrawer({ kind: "brand", category, brand: null })}
								onEditBrand={(brand) => setDrawer({ kind: "brand", category, brand })}
								onRemoveBrand={(brand) =>
									setDeleteIntent({
										kind: "brand",
										id: brand.id,
										label: brand.name,
										unlinkFromCategorySlug: category.slug,
									})
								}
								onAddAttribute={() =>
									setDrawer({
										kind: "attribute",
										category,
										attribute: null,
									})
								}
								onEditAttribute={(attribute) => setDrawer({ kind: "attribute", category, attribute })}
								onDeleteAttribute={(attribute) =>
									setDeleteIntent({
										kind: "attribute",
										id: attribute.id,
										label: attribute.label,
									})
								}
							/>
						</li>
					))}
				</ul>
			)}

			<CategoryEditor isOpen={drawer?.kind === "category"} onClose={() => setDrawer(null)} category={drawer?.kind === "category" ? drawer.category : null} onSaved={refreshAll} />
			{drawer?.kind === "brand" && (
				<BrandEditor
					isOpen
					onClose={() => setDrawer(null)}
					category={drawer.category}
					brand={drawer.brand}
					siblings={brands.filter((b) => b.categorySlugs.includes(drawer.category.slug))}
					onSaved={refreshAll}
				/>
			)}
			{drawer?.kind === "attribute" && (
				<AttributeEditor
					isOpen
					onClose={() => setDrawer(null)}
					category={drawer.category}
					attribute={drawer.attribute}
					brands={brands.filter((row) => row.categorySlugs.includes(drawer.category.slug))}
					onSaved={refreshAll}
				/>
			)}

			<ConfirmDialog
				isOpen={deleteIntent !== null}
				onCancel={() => setDeleteIntent(null)}
				onConfirm={handleConfirmDelete}
				title={deleteIntent ? `Delete "${deleteIntent.label}"?` : "Delete"}
				message={
					deleteIntent?.kind === "brand" && deleteIntent.unlinkFromCategorySlug
						? "If this brand isn't linked to any other category it will be removed entirely."
						: "This cannot be undone."
				}
				confirmLabel="Delete"
				tone="danger"
			/>
		</>
	);
}

interface CategoryCardProps {
	category: AdminCategory;
	brands: AdminBrand[];
	attributes: AdminAttribute[];
	visibleSections: Set<CatalogSection>;
	canManageCategories: boolean;
	isFirst: boolean;
	isLast: boolean;
	onEditCategory: () => void;
	onDeleteCategory: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onAddBrand: () => void;
	onEditBrand: (brand: AdminBrand) => void;
	onRemoveBrand: (brand: AdminBrand) => void;
	onAddAttribute: () => void;
	onEditAttribute: (attribute: AdminAttribute) => void;
	onDeleteAttribute: (attribute: AdminAttribute) => void;
}

function CategoryCard({
	category,
	brands,
	attributes,
	visibleSections,
	canManageCategories,
	isFirst,
	isLast,
	onEditCategory,
	onDeleteCategory,
	onMoveUp,
	onMoveDown,
	onAddBrand,
	onEditBrand,
	onRemoveBrand,
	onAddAttribute,
	onEditAttribute,
	onDeleteAttribute,
}: CategoryCardProps) {
	const categoryOnly = visibleSections.size === 0;

	return (
		<article className="flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
			<header className="flex items-start gap-3">
				<CategoryIconBlock category={category} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate text-[17px] font-semibold text-[var(--color-ink-900)]">{category.label}</h2>
						{canManageCategories ? (
							<span title={category.isActive ? "Live on storefront" : "Hidden from storefront"}>
								<CatalogVisibilityToggle endpoint={`/api/categories/${category.id}`} label={category.label} isActive={category.isActive} />
							</span>
						) : (
							!category.isActive && (
								<span className="rounded-full bg-[var(--color-ink-100)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-500)]">
									Hidden
								</span>
							)
						)}
					</div>
					{categoryOnly ? (
						<div className="mt-1.5">
							<StructuredContentFullPreview
								content={category.content}
								fallback={category.description}
								iconColor="var(--color-accent-700)"
								iconSizeClass="size-3"
								iconSize={11}
								bulletItemClassName="text-[12.5px] text-[var(--color-ink-700)]"
							/>
						</div>
					) : (
						<p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--color-ink-600)]">{category.description}</p>
					)}
					<p className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ink-400)]">slug: {category.slug}</p>
				</div>
				{canManageCategories && (
					<div className="flex items-center gap-1">
						<CardIconButton label="Move up" disabled={isFirst} onClick={onMoveUp} icon={<ChevronUp size={14} />} />
						<CardIconButton label="Move down" disabled={isLast} onClick={onMoveDown} icon={<ChevronDown size={14} />} />
						<CardIconButton label="Edit category" onClick={onEditCategory} icon={<Pencil size={14} />} />
						<CardIconButton label="Delete category" onClick={onDeleteCategory} icon={<Trash2 size={14} />} tone="danger" />
					</div>
				)}
			</header>

			{visibleSections.has("brands") && (
				<CardBlock title="Brands" onAdd={onAddBrand} addLabel="Add brand">
					{brands.length === 0 ? (
						<EmptyBlock copy="No brands yet — add one to power the filter sidebar and product card chip." />
					) : (
						<ul className="flex flex-wrap gap-1.5">
							{brands.map((brand) => (
								<li key={brand.id}>
									<span className="group inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 py-1 text-[12.5px] font-semibold text-[var(--color-ink-800)]">
										<button type="button" onClick={() => onEditBrand(brand)} className="hover:text-[var(--color-accent-700)]">
											{brand.name}
										</button>
										<button
											type="button"
											onClick={() => onRemoveBrand(brand)}
											aria-label={`Remove ${brand.name} from ${category.label}`}
											className="rounded-full p-0.5 text-[var(--color-ink-400)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-rose-100)] hover:text-[var(--color-rose-700)]"
										>
											<Trash2 size={11} />
										</button>
									</span>
								</li>
							))}
						</ul>
					)}
				</CardBlock>
			)}

			{visibleSections.has("attributes") && (
				<CardBlock title="Attributes" onAdd={onAddAttribute} addLabel="Add attribute">
					{attributes.length === 0 ? (
						<EmptyBlock copy="No attributes yet — define dimensions like Storage, RAM, or Color." />
					) : (
						<ul className="flex flex-col gap-1.5">
							{attributes.map((attribute) => (
								<li key={attribute.id}>
									<button
										type="button"
										onClick={() => onEditAttribute(attribute)}
										className="group flex w-full items-center gap-2 rounded-md border border-transparent bg-[var(--color-canvas-deep)] px-2 py-1.5 text-left hover:border-[var(--color-accent-200)]"
									>
										<Tag size={12} className="shrink-0 text-[var(--color-ink-500)]" />
										<span className="flex-1 truncate text-[13px] font-semibold text-[var(--color-ink-900)]">{attribute.label}</span>
										<span className="rounded-full bg-[var(--color-ink-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink-700)]">
											{attribute.options.length} opts
										</span>
										<span className="rounded-full bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-800)]">
											{attribute.cardPosition}
										</span>
										<span
											role="presentation"
											onClick={(event) => {
												event.stopPropagation();
												onDeleteAttribute(attribute);
											}}
											className="rounded p-1 text-[var(--color-ink-400)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-rose-100)] hover:text-[var(--color-rose-700)]"
										>
											<Trash2 size={12} />
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</CardBlock>
			)}
		</article>
	);
}

function CategoryIconBlock({ category }: { category: AdminCategory }) {
	return (
		<span className="grid size-12 shrink-0 place-items-center rounded-md bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]" aria-hidden>
			<LucideIconRenderer name={category.icon} size={24} strokeWidth={2.2} />
		</span>
	);
}

function CardBlock({ title, onAdd, addLabel, children }: { title: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
	return (
		<section className="rounded-md border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/30 p-3">
			<header className="mb-2 flex items-center justify-between gap-2">
				<h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{title}</h3>
				<button
					type="button"
					onClick={onAdd}
					className="inline-flex items-center gap-1 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)]"
				>
					<Plus size={11} /> {addLabel}
				</button>
			</header>
			{children}
		</section>
	);
}

function EmptyBlock({ copy }: { copy: string }) {
	return <p className="rounded-md border border-dashed border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-3 text-[12px] italic text-[var(--color-ink-500)]">{copy}</p>;
}

function CardIconButton({
	label,
	icon,
	onClick,
	disabled,
	tone = "neutral",
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	tone?: "neutral" | "danger";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			disabled={disabled}
			className={
				"rounded p-1.5 transition disabled:opacity-30 " +
				(tone === "danger"
					? "text-[var(--color-ink-500)] hover:bg-[var(--color-rose-100)] hover:text-[var(--color-rose-700)]"
					: "text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]")
			}
		>
			{icon}
		</button>
	);
}
