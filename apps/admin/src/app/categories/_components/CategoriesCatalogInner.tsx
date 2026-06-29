"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { compareAlphabetically } from "@store/shared";

import { WorkspaceFrame } from "@/components/shared/workspaceUi";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { drawerItemFromState, drawerUrlSignature, formatCatalogDeleteParam, parseCatalogDeleteParam, resolveCatalogDrawer } from "@/lib/url/catalogDrawerUrl";
import { syncAfterPendingUrl, useUrlParams } from "@/lib/url/useUrlParams";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";

import { Categories } from "./Categories";
import { CategoriesCatalogTablesPanel } from "./categoriesCatalogTablesPanel";
import { type CatalogTab, type CategoryNavItem, type DeleteIntent, type DrawerKind, type WorkspaceView, isCatalogTab, matchesQuery } from "./categoriesCatalogTypes";
import { CategorySidebar } from "./categoriesCatalogUi";

const AttributeEditor = dynamic(() => import("./AttributeEditor").then((mod) => ({ default: mod.AttributeEditor })), { ssr: false });
const BrandEditor = dynamic(() => import("./BrandEditor").then((mod) => ({ default: mod.BrandEditor })), { ssr: false });
const CategoryEditor = dynamic(() => import("./CategoryEditor").then((mod) => ({ default: mod.CategoryEditor })), { ssr: false });

export interface CategoriesCatalogInnerProps {
	initialCategories: AdminCategory[];
	initialBrands: AdminBrand[];
	initialAttributes: AdminAttribute[];
}

export function CategoriesCatalogInner({ initialCategories, initialBrands, initialAttributes }: CategoriesCatalogInnerProps) {
	const { searchParams, replace } = useUrlParams();
	const toast = useToast();

	const [categories, setCategories] = useState(initialCategories);
	const [brands, setBrands] = useState(initialBrands);
	const [attributes, setAttributes] = useState(initialAttributes);

	const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<CatalogTab>("brands");
	const [categoryQuery, setCategoryQuery] = useState("");
	const [rowQuery, setRowQuery] = useState("");
	const [drawer, setDrawer] = useState<DrawerKind>(null);
	const [categoryEditorMounted, setCategoryEditorMounted] = useState(false);
	const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
	const [viewMode, setViewMode] = useState<WorkspaceView>("tables");
	const prevViewModeRef = useRef<WorkspaceView>("tables");
	const pendingCategorySlugRef = useRef<string | null>(null);
	const pendingDrawerRef = useRef<string | null>(null);
	const pendingRowQueryRef = useRef<string | null>(null);
	const pendingCategoryQueryRef = useRef<string | null>(null);
	const pendingDeleteRef = useRef<string | null>(null);

	const refreshAll = useCallback(async () => {
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
			toast.danger(error instanceof ApiError ? error.message : "Failed to refresh catalog.");
		}
	}, [toast]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			setCategories(initialCategories);
		});
	}, [initialCategories]);
	useEffect(() => {
		scheduleStateUpdate(() => {
			setBrands(initialBrands);
		});
	}, [initialBrands]);
	useEffect(() => {
		scheduleStateUpdate(() => {
			setAttributes(initialAttributes);
		});
	}, [initialAttributes]);

	const setCategoryUrl = useCallback(
		(categorySlug: string) => {
			replace({
				category: categorySlug,
				tab: searchParams.get("tab") ?? "brands",
			});
		},
		[replace, searchParams],
	);

	const setTabUrl = useCallback(
		(tab: CatalogTab) => {
			replace({
				tab,
				...(selectedCategorySlug ? { category: selectedCategorySlug } : {}),
				q: null,
			});
			setRowQuery("");
		},
		[replace, selectedCategorySlug],
	);

	const setViewUrl = useCallback(
		(mode: WorkspaceView) => {
			replace({ view: mode === "cards" ? "cards" : null });
		},
		[replace],
	);

	const openDrawerUrl = useCallback(
		(next: DrawerKind) => {
			const signature = next ? drawerUrlSignature(next.kind, drawerItemFromState(next)) : null;
			pendingDrawerRef.current = signature;
			setDrawer(next);
			if (next?.kind === "category") {
				setCategoryEditorMounted(true);
			}
			if (!next) {
				replace({ drawer: null, item: null });
				return;
			}
			replace({
				drawer: next.kind,
				item: drawerItemFromState(next),
			});
		},
		[replace],
	);

	const closeDrawerUrl = useCallback(() => {
		openDrawerUrl(null);
	}, [openDrawerUrl]);

	const setRowQueryUrl = useCallback(
		(query: string) => {
			const trimmed = query.trim();
			pendingRowQueryRef.current = trimmed || null;
			setRowQuery(query);
			replace({ q: trimmed || null });
		},
		[replace],
	);

	const setCategoryQueryUrl = useCallback(
		(query: string) => {
			const trimmed = query.trim();
			pendingCategoryQueryRef.current = trimmed || null;
			setCategoryQuery(query);
			replace({ cq: trimmed || null });
		},
		[replace],
	);

	const openDeleteUrl = useCallback(
		(intent: DeleteIntent) => {
			const param = formatCatalogDeleteParam(intent.kind, intent.id);
			pendingDeleteRef.current = param;
			setDeleteIntent(intent);
			replace({ delete: param });
		},
		[replace],
	);

	const closeDeleteUrl = useCallback(() => {
		pendingDeleteRef.current = null;
		setDeleteIntent(null);
		replace({ delete: null });
	}, [replace]);

	const openCardView = useCallback(() => {
		setViewMode("cards");
		setViewUrl("cards");
	}, [setViewUrl]);

	const openTableView = useCallback(() => {
		setViewMode("tables");
		setViewUrl("tables");
	}, [setViewUrl]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			const viewParam = searchParams.get("view");
			setViewMode(viewParam === "cards" ? "cards" : "tables");
		});
	}, [searchParams]);

	useEffect(() => {
		const fromUrl = searchParams.get("q") ?? "";
		if (!syncAfterPendingUrl(pendingRowQueryRef, fromUrl || null)) return;
		setRowQuery(fromUrl);
	}, [searchParams]);

	useEffect(() => {
		const fromUrl = searchParams.get("cq") ?? "";
		if (!syncAfterPendingUrl(pendingCategoryQueryRef, fromUrl || null)) return;
		setCategoryQuery(fromUrl);
	}, [searchParams]);

	useEffect(() => {
		if (prevViewModeRef.current === "cards" && viewMode === "tables") {
			void refreshAll();
		}
		prevViewModeRef.current = viewMode;
	}, [viewMode, refreshAll]);

	const categoryNav = useMemo((): CategoryNavItem[] => {
		return categories.map((category) => ({
			category,
			brandCount: brands.filter((row) => row.categorySlugs.includes(category.slug)).length,
			attributeCount: attributes.filter((row) => row.categorySlug === category.slug).length,
		}));
	}, [categories, brands, attributes]);

	const filteredCategoryNav = useMemo(() => {
		if (!categoryQuery.trim()) return categoryNav;
		return categoryNav.filter(({ category }) => matchesQuery([category.label, category.slug].join(" "), categoryQuery));
	}, [categoryNav, categoryQuery]);

	const selectCategory = useCallback(
		(slug: string) => {
			pendingCategorySlugRef.current = slug;
			setSelectedCategorySlug(slug);
			setRowQuery("");
			setCategoryUrl(slug);
		},
		[setCategoryUrl],
	);

	useEffect(() => {
		const fromUrl = searchParams.get("category");
		const tabParam = searchParams.get("tab");
		const pending = pendingCategorySlugRef.current;

		scheduleStateUpdate(() => {
			if (isCatalogTab(tabParam)) {
				setActiveTab(tabParam);
			} else if (tabParam === "grades") {
				setActiveTab("brands");
			}

			if (pending) {
				if (fromUrl === pending) {
					pendingCategorySlugRef.current = null;
				} else {
					return;
				}
			}

			if (fromUrl && categoryNav.some((row) => row.category.slug === fromUrl)) {
				setSelectedCategorySlug(fromUrl);
				return;
			}
			if (categoryNav.length === 0) {
				setSelectedCategorySlug(null);
				return;
			}
			const preferred = categoryNav[0];
			setSelectedCategorySlug(preferred.category.slug);
			setCategoryUrl(preferred.category.slug);
		});
	}, [categoryNav, searchParams, setCategoryUrl]);

	useEffect(() => {
		if (!categoryQuery.trim() || filteredCategoryNav.length === 0) return;
		const stillVisible = filteredCategoryNav.some((row) => row.category.slug === selectedCategorySlug);
		if (!stillVisible) {
			scheduleStateUpdate(() => {
				selectCategory(filteredCategoryNav[0].category.slug);
			});
		}
	}, [categoryQuery, filteredCategoryNav, selectedCategorySlug, selectCategory]);

	const selectedNav = categoryNav.find((row) => row.category.slug === selectedCategorySlug);
	const selectedCategory = selectedNav?.category ?? null;

	useEffect(() => {
		const drawerParam = searchParams.get("drawer");
		const itemParam = searchParams.get("item");
		const signature = drawerUrlSignature(drawerParam, itemParam);
		if (!syncAfterPendingUrl(pendingDrawerRef, signature)) return;
		const resolved = resolveCatalogDrawer({
			drawer: drawerParam,
			item: itemParam,
			category: selectedCategory,
			categories,
			brands,
			attributes,
		});
		scheduleStateUpdate(() => {
			setDrawer(resolved);
			if (resolved?.kind === "category") {
				setCategoryEditorMounted(true);
			}
		});
	}, [searchParams, selectedCategory, categories, brands, attributes]);

	useEffect(() => {
		const deleteParam = searchParams.get("delete");
		if (!syncAfterPendingUrl(pendingDeleteRef, deleteParam)) return;
		const parsed = parseCatalogDeleteParam(deleteParam);
		scheduleStateUpdate(() => {
			if (!parsed) {
				setDeleteIntent(null);
				return;
			}
			if (parsed.kind === "category") {
				const category = categories.find((row) => row.id === parsed.id);
				if (!category) {
					setDeleteIntent(null);
					return;
				}
				setDeleteIntent({
					kind: "category",
					id: category.id,
					label: category.label,
				});
				return;
			}
			if (parsed.kind === "brand") {
				const brand = brands.find((row) => row.id === parsed.id);
				if (!brand || !selectedCategory) {
					setDeleteIntent(null);
					return;
				}
				setDeleteIntent({
					kind: "brand",
					id: brand.id,
					label: brand.name,
					unlinkFromCategorySlug: selectedCategory.slug,
				});
				return;
			}
			const attribute = attributes.find((row) => row.id === parsed.id);
			if (!attribute) {
				setDeleteIntent(null);
				return;
			}
			setDeleteIntent({
				kind: "attribute",
				id: attribute.id,
				label: attribute.label,
			});
		});
	}, [searchParams, categories, brands, attributes, selectedCategory]);

	const brandsForCategory = useMemo(() => {
		if (!selectedCategorySlug) return [];
		return brands.filter((row) => row.categorySlugs.includes(selectedCategorySlug)).sort((left, right) => compareAlphabetically(left.name, right.name));
	}, [brands, selectedCategorySlug]);

	const attributesForCategory = useMemo(() => {
		if (!selectedCategorySlug) return [];
		return attributes.filter((row) => row.categorySlug === selectedCategorySlug).sort((left, right) => compareAlphabetically(left.label, right.label));
	}, [attributes, selectedCategorySlug]);

	const filteredBrands = useMemo(() => {
		if (!rowQuery.trim()) return brandsForCategory;
		return brandsForCategory.filter((row) => matchesQuery([row.name, row.slug].join(" "), rowQuery));
	}, [brandsForCategory, rowQuery]);

	const filteredAttributes = useMemo(() => {
		if (!rowQuery.trim()) return attributesForCategory;
		return attributesForCategory.filter((row) => matchesQuery([row.label, row.slug, row.unit ?? "", row.cardPosition].join(" "), rowQuery));
	}, [attributesForCategory, rowQuery]);

	async function handleConfirmDelete() {
		if (!deleteIntent) return;
		const { kind, id, label, unlinkFromCategorySlug } = deleteIntent;
		closeDeleteUrl();
		try {
			if (kind === "brand" && unlinkFromCategorySlug) {
				const brand = brands.find((row) => row.id === id);
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
			toast.danger(error instanceof ApiError ? error.message : `Failed to delete ${deleteIntent.kind}.`);
		}
	}

	async function moveCategory(category: AdminCategory, direction: -1 | 1) {
		const currentIndex = categories.findIndex((row) => row.id === category.id);
		if (currentIndex === -1) return;
		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= categories.length) return;
		const reordered = [...categories];
		const [moved] = reordered.splice(currentIndex, 1);
		if (!moved) return;
		reordered.splice(nextIndex, 0, moved);
		try {
			await Promise.all(
				reordered.map((row, index) =>
					apiFetch<AdminCategory>(`/api/categories/${row.id}`, {
						method: "PUT",
						json: { sortOrder: index },
					}),
				),
			);
			await refreshAll();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to reorder category.");
		}
	}

	function openCreateForTab() {
		if (!selectedCategory) return;
		if (activeTab === "brands") {
			openDrawerUrl({ kind: "brand", category: selectedCategory, brand: null });
			return;
		}
		openDrawerUrl({ kind: "attribute", category: selectedCategory, attribute: null });
	}

	const newButtonLabel = activeTab === "brands" ? "New brand" : "New attribute";
	const rowSearchPlaceholder = activeTab === "brands" ? "Search brands…" : "Search attributes…";

	return (
		<>
			<WorkspaceFrame minHeight={false}>
				<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
					<CategorySidebar
						items={filteredCategoryNav}
						selectedSlug={selectedCategorySlug}
						onSelect={selectCategory}
						categoryQuery={categoryQuery}
						onCategoryQueryChange={setCategoryQueryUrl}
						isFiltered={categoryQuery.trim().length > 0}
						viewMode={viewMode}
						onOpenCardView={openCardView}
						onOpenTableView={openTableView}
					/>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						{viewMode === "cards" ? (
							<div className="min-h-0 flex-1 overflow-y-auto p-2">
								<Categories embedded initialCategories={categories} initialBrands={brands} initialAttributes={attributes} visibleSections={[]} />
							</div>
						) : (
							<CategoriesCatalogTablesPanel
								categories={categories}
								selectedNav={selectedNav}
								selectedCategory={selectedCategory}
								activeTab={activeTab}
								setActiveTab={setActiveTab}
								rowQuery={rowQuery}
								setRowQuery={setRowQuery}
								setRowQueryUrl={setRowQueryUrl}
								setTabUrl={setTabUrl}
								filteredBrands={filteredBrands}
								filteredAttributes={filteredAttributes}
								newButtonLabel={newButtonLabel}
								rowSearchPlaceholder={rowSearchPlaceholder}
								openCreateForTab={openCreateForTab}
								moveCategory={moveCategory}
								openDrawerUrl={openDrawerUrl}
								openDeleteUrl={openDeleteUrl}
							/>
						)}
					</div>
				</div>
			</WorkspaceFrame>

			{categoryEditorMounted ? (
				<CategoryEditor isOpen={drawer?.kind === "category"} onClose={closeDrawerUrl} category={drawer?.kind === "category" ? drawer.category : null} onSaved={refreshAll} />
			) : null}
			{drawer?.kind === "brand" && (
				<BrandEditor
					isOpen
					onClose={closeDrawerUrl}
					category={drawer.category}
					brand={drawer.brand}
					siblings={brands.filter((row) => row.categorySlugs.includes(drawer.category.slug))}
					onSaved={refreshAll}
				/>
			)}
			{drawer?.kind === "attribute" && (
				<AttributeEditor
					isOpen
					onClose={closeDrawerUrl}
					category={drawer.category}
					attribute={drawer.attribute}
					brands={brands.filter((row) => row.categorySlugs.includes(drawer.category.slug))}
					onSaved={refreshAll}
				/>
			)}

			<ConfirmDialog
				isOpen={deleteIntent !== null}
				onCancel={closeDeleteUrl}
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
