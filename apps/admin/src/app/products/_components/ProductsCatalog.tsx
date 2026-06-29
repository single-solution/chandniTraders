"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Boxes, Check, ExternalLink, EyeOff, Star } from "lucide-react";
import { classNames, compareAlphabetically, emptyStructuredContent, formatPrice, resolvePublicSiteUrl, seoScoreTone } from "@store/shared";

import { CatalogSearchField } from "@/components/shared/catalogWorkspaceUi";
import { Table, type TableColumn } from "@/components/ui/Table";
import { WorkspaceCatalogPaneHeader, WorkspaceFrame, WorkspaceReadOnlyBanner } from "@/components/shared/workspaceUi";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { FilterDropdown, type FilterOption } from "@/components/ui/FilterDropdown";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import { CatalogWorkspaceSkeleton } from "@/components/loading/CatalogWorkspaceSkeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { getInitials } from "@/lib/initials";
import type { ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";
import { variantStockRollup, type VariantStockRollup } from "@/lib/products/productVariantStock";
import { syncAfterPendingUrl, useUrlParams } from "@/lib/url/useUrlParams";
import type { AdminCategory, AdminProductSummary } from "@/types/models";

import { useStoreSettings } from "@/lib/storeSettingsContext";

import { ProductCreateWizard } from "./ProductCreateWizard";
import { ProductRowEditMenu } from "./ProductRowEditMenu";

// The edit drawer carries the variant editor, structured-content
// editor, and image upload — together by far the heaviest client modules on
// this page. Dynamic-import + render-on-demand keeps that JS out of the
// initial /products bundle. Once a drawer opens it stays mounted, so close
// animations and form state are preserved across subsequent opens.
import type { ProductEditStep } from "./ProductEditDrawer";

const ProductEditDrawer = dynamic(
	() =>
		import("./ProductEditDrawer").then((mod) => ({
			default: mod.ProductEditDrawer,
		})),
	{ ssr: false },
);

interface ProductsCatalogProps {
	products: AdminProductSummary[];
	catalog: ProductWizardCatalog;
}

type ProductPanel = "details" | "variants" | "seo";

const PANEL_TO_STEP: Record<ProductPanel, ProductEditStep> = {
	details: 1,
	variants: 2,
	seo: 3,
};

function parseProductPanel(value: string | null): ProductPanel | null {
	if (value === "details" || value === "variants" || value === "seo") {
		return value;
	}
	if (value === "edit") {
		return "details";
	}
	return null;
}

interface CategoryNavItem {
	category: AdminCategory;
	totalCount: number;
}

const UNCATEGORIZED_SLUG = "uncategorized";

type StockFilter = "all" | "no_variants" | "all_out_of_stock" | "partial_stock" | "fully_stocked";

type StatusFilter = "all" | "active" | "disabled";
type FeaturedFilter = "all" | "yes" | "no";
type PhotosFilter = "all" | "with" | "without";

interface ProductFilters {
	brands: string[];
	stock: StockFilter;
	status: StatusFilter;
	featured: FeaturedFilter;
	photos: PhotosFilter;
}

const DEFAULT_FILTERS: ProductFilters = {
	brands: [],
	stock: "all",
	status: "all",
	featured: "all",
	photos: "all",
};

const STOCK_OPTIONS: FilterOption[] = [
	{ value: "no_variants", label: "No variants" },
	{ value: "all_out_of_stock", label: "All out of stock" },
	{ value: "partial_stock", label: "Partial stock" },
	{ value: "fully_stocked", label: "Fully stocked" },
];

const STATUS_OPTIONS: FilterOption[] = [
	{ value: "active", label: "Live on storefront" },
	{ value: "disabled", label: "Disabled" },
];

const FEATURED_OPTIONS: FilterOption[] = [
	{ value: "yes", label: "Featured" },
	{ value: "no", label: "Not featured" },
];

const PHOTOS_OPTIONS: FilterOption[] = [
	{ value: "with", label: "Has photos" },
	{ value: "without", label: "Missing photos" },
];

const STOCK_VALUES = new Set<StockFilter>(["no_variants", "all_out_of_stock", "partial_stock", "fully_stocked"]);

function asStockFilter(value: string | null): StockFilter {
	return value && STOCK_VALUES.has(value as StockFilter) ? (value as StockFilter) : "all";
}

function asStatusFilter(value: string | null): StatusFilter {
	return value === "active" || value === "disabled" ? value : "all";
}

function asFeaturedFilter(value: string | null): FeaturedFilter {
	return value === "yes" || value === "no" ? value : "all";
}

function asPhotosFilter(value: string | null): PhotosFilter {
	return value === "with" || value === "without" ? value : "all";
}

function parseCsv(value: string | null): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/** Read every filter dimension out of the URL in one pass. */
function readFiltersFromUrl(searchParams: URLSearchParams): ProductFilters {
	return {
		brands: parseCsv(searchParams.get("brand")),
		stock: asStockFilter(searchParams.get("stock")),
		status: asStatusFilter(searchParams.get("status")),
		featured: asFeaturedFilter(searchParams.get("featured")),
		photos: asPhotosFilter(searchParams.get("photos")),
	};
}

function filtersEqual(left: ProductFilters, right: ProductFilters): boolean {
	if (left.stock !== right.stock || left.status !== right.status || left.featured !== right.featured || left.photos !== right.photos) {
		return false;
	}
	if (left.brands.length !== right.brands.length) return false;
	for (let index = 0; index < left.brands.length; index += 1) {
		if (left.brands[index] !== right.brands[index]) return false;
	}
	return true;
}

function hasActiveFilters(filters: ProductFilters): boolean {
	return filters.stock !== "all" || filters.status !== "all" || filters.featured !== "all" || filters.photos !== "all" || filters.brands.length > 0;
}

function matchesFilters(product: AdminProductSummary, filters: ProductFilters): boolean {
	if (filters.stock !== "all" && variantStockRollup(product) !== filters.stock) {
		return false;
	}
	if (filters.status === "active" && !product.isActive) return false;
	if (filters.status === "disabled" && product.isActive) return false;
	if (filters.featured === "yes" && !product.isFeatured) return false;
	if (filters.featured === "no" && product.isFeatured) return false;
	if (filters.photos === "with" && !product.hasImages) return false;
	if (filters.photos === "without" && product.hasImages) return false;
	if (filters.brands.length > 0 && !filters.brands.includes(product.brand.slug)) {
		return false;
	}
	return true;
}

function matchesQuery(haystack: string, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return haystack.toLowerCase().includes(needle);
}

function productSearchHaystack(product: AdminProductSummary): string {
	return [product.name, product.brand.name, product.brand.slug, product.slug].filter(Boolean).join(" ");
}

function categorySearchHaystack(category: AdminCategory): string {
	return [category.label, category.slug].filter(Boolean).join(" ");
}

export function ProductsCatalog(props: ProductsCatalogProps) {
	return (
		<Suspense fallback={<CatalogWorkspaceSkeleton />}>
			<ProductsCatalogInner {...props} />
		</Suspense>
	);
}

function ProductsCatalogInner({ products, catalog }: ProductsCatalogProps) {
	const store = useStoreSettings();
	const publicUrl = resolvePublicSiteUrl(store.publicSiteUrl);
	const router = useRouter();
	const { searchParams, replace } = useUrlParams();
	const toast = useToast();
	const { can } = useAdminPermissions();
	const canCreate = can("product_create");
	const canUpdate = can("product_update");
	const canDelete = can("product_delete");

	const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
	const [editState, setEditState] = useState<{
		productId: string;
		panel: ProductPanel;
	} | null>(null);
	// Once a drawer has been opened we keep it mounted so its close
	// animation runs and the dynamic chunk stays cached. Initial render
	// never mounts either drawer, so its bundle stays out of the cold
	// load until the operator actually clicks Edit.
	const [editDrawerMounted, setEditDrawerMounted] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<AdminProductSummary | null>(null);
	const [categoryQuery, setCategoryQuery] = useState("");
	const [productQuery, setProductQuery] = useState("");
	const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
	// URL sync uses pending refs + scheduleStateUpdate to avoid replace loops.
	const pendingCategorySlugRef = useRef<string | null>(null);
	const pendingProductQueryRef = useRef<string | null>(null);
	const pendingCategoryQueryRef = useRef<string | null>(null);
	const pendingDeleteIdRef = useRef<string | null>(null);
	const pendingFiltersRef = useRef<ProductFilters | null>(null);

	const openEdit = useCallback(
		(id: string, panel: ProductPanel) => {
			setEditState({ productId: id, panel });
			setEditDrawerMounted(true);
			replace({
				product: id,
				panel,
				vuid: null,
			});
		},
		[replace],
	);

	const closePanels = useCallback(() => {
		setEditState(null);
		replace({
			product: null,
			panel: null,
			vuid: null,
		});
	}, [replace]);

	const setCategoryUrl = useCallback(
		(categorySlug: string) => {
			replace({ category: categorySlug });
		},
		[replace],
	);

	useEffect(() => {
		const productId = searchParams.get("product");
		const panel = parseProductPanel(searchParams.get("panel"));
		scheduleStateUpdate(() => {
			if (!productId || !panel) {
				setEditState(null);
				return;
			}
			if (!canUpdate) {
				setEditState(null);
				replace({ product: productId, panel: null, vuid: null });
				return;
			}
			setEditState({ productId, panel });
			setEditDrawerMounted(true);
		});
	}, [canUpdate, replace, searchParams]);

	useEffect(() => {
		const fromUrl = searchParams.get("q") ?? "";
		if (!syncAfterPendingUrl(pendingProductQueryRef, fromUrl || null)) return;
		setProductQuery(fromUrl);
	}, [searchParams]);

	useEffect(() => {
		const fromUrl = searchParams.get("cq") ?? "";
		if (!syncAfterPendingUrl(pendingCategoryQueryRef, fromUrl || null)) return;
		setCategoryQuery(fromUrl);
	}, [searchParams]);

	// URL → filter state sync. We re-parse every filter dimension on each
	// searchParams change. A pending-snapshot guard (`pendingFiltersRef`)
	// skips this sync until the URL catches up to the patch we just
	// pushed, mirroring the pattern used for `q`, `cq`, and `delete`.
	useEffect(() => {
		const parsed = readFiltersFromUrl(new URLSearchParams(searchParams.toString()));
		const pending = pendingFiltersRef.current;
		if (pending) {
			if (filtersEqual(parsed, pending)) {
				pendingFiltersRef.current = null;
			} else {
				return;
			}
		}
		scheduleStateUpdate(() => {
			setFilters((current) => (filtersEqual(current, parsed) ? current : parsed));
		});
	}, [searchParams]);

	useEffect(() => {
		const deleteId = searchParams.get("delete");
		if (!syncAfterPendingUrl(pendingDeleteIdRef, deleteId)) return;
		scheduleStateUpdate(() => {
			if (!deleteId) {
				setDeleteTarget(null);
				return;
			}
			const match = products.find((row) => row.id === deleteId);
			setDeleteTarget(match ?? null);
		});
	}, [searchParams, products]);

	const setProductQueryUrl = useCallback(
		(query: string) => {
			const trimmed = query.trim();
			pendingProductQueryRef.current = trimmed || null;
			setProductQuery(query);
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

	const updateFilters = useCallback(
		(patch: Partial<ProductFilters>) => {
			const next: ProductFilters = {
				brands: patch.brands ?? filters.brands,
				stock: patch.stock ?? filters.stock,
				status: patch.status ?? filters.status,
				featured: patch.featured ?? filters.featured,
				photos: patch.photos ?? filters.photos,
			};
			pendingFiltersRef.current = next;
			setFilters(next);
			replace({
				brand: next.brands.length > 0 ? next.brands.join(",") : null,
				stock: next.stock === "all" ? null : next.stock,
				status: next.status === "all" ? null : next.status,
				featured: next.featured === "all" ? null : next.featured,
				photos: next.photos === "all" ? null : next.photos,
			});
		},
		[filters, replace],
	);

	const clearFilters = useCallback(() => {
		updateFilters(DEFAULT_FILTERS);
	}, [updateFilters]);

	const openDeleteConfirm = useCallback(
		(product: AdminProductSummary) => {
			pendingDeleteIdRef.current = product.id;
			setDeleteTarget(product);
			replace({ delete: product.id });
		},
		[replace],
	);

	const closeDeleteConfirm = useCallback(() => {
		pendingDeleteIdRef.current = null;
		setDeleteTarget(null);
		replace({ delete: null });
	}, [replace]);

	const totalByCategory = useMemo(() => {
		const map = new Map<string, number>();
		for (const product of products) {
			map.set(product.categorySlug, (map.get(product.categorySlug) ?? 0) + 1);
		}
		return map;
	}, [products]);

	const categoryNav = useMemo((): CategoryNavItem[] => {
		const knownSlugs = new Set(catalog.categories.map((row) => row.slug));
		const items: CategoryNavItem[] = catalog.categories.map((category) => ({
			category,
			totalCount: totalByCategory.get(category.slug) ?? 0,
		}));

		const orphanTotal = [...totalByCategory.entries()].filter(([slug]) => !knownSlugs.has(slug)).reduce((sum, [, count]) => sum + count, 0);

		if (orphanTotal > 0) {
			items.push({
				category: {
					id: UNCATEGORIZED_SLUG,
					slug: UNCATEGORIZED_SLUG,
					label: "Uncategorized",
					description: "",
					icon: "package",
					isActive: true,
					sortOrder: 999,
					content: emptyStructuredContent(),
					createdAt: "",
					updatedAt: "",
				},
				totalCount: orphanTotal,
			});
		}

		return items;
	}, [catalog.categories, totalByCategory]);

	const selectCategory = useCallback(
		(slug: string) => {
			pendingCategorySlugRef.current = slug;
			setSelectedCategorySlug(slug);

			// Brand filters are category-scoped: a Royal brand under Fans
			// doesn't exist under Lights, so leaving the chip active
			// after a switch would silently exclude every product. Stock,
			// status, featured, and photos are catalog-wide so they survive.
			const nextFilters: ProductFilters = {
				...filters,
				brands: [],
			};
			pendingFiltersRef.current = nextFilters;
			setFilters(nextFilters);
			replace({ category: slug, brand: null });
		},
		[filters, replace],
	);

	useEffect(() => {
		const fromUrl = searchParams.get("category");
		const pending = pendingCategorySlugRef.current;

		scheduleStateUpdate(() => {
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
			const preferred = categoryNav.find((row) => row.totalCount > 0) ?? categoryNav[0];
			setSelectedCategorySlug(preferred.category.slug);
			setCategoryUrl(preferred.category.slug);
		});
	}, [categoryNav, searchParams, setCategoryUrl]);

	const selectedNav = categoryNav.find((row) => row.category.slug === selectedCategorySlug);

	const filteredCategoryNav = useMemo(() => {
		if (!categoryQuery.trim()) return categoryNav;
		return categoryNav.filter(({ category }) => matchesQuery(categorySearchHaystack(category), categoryQuery));
	}, [categoryNav, categoryQuery]);

	useEffect(() => {
		if (!categoryQuery.trim() || filteredCategoryNav.length === 0) return;
		const stillVisible = filteredCategoryNav.some((row) => row.category.slug === selectedCategorySlug);
		if (!stillVisible) {
			scheduleStateUpdate(() => {
				selectCategory(filteredCategoryNav[0].category.slug);
			});
		}
	}, [categoryQuery, filteredCategoryNav, selectedCategorySlug, selectCategory]);

	const categoryProducts = useMemo(() => {
		if (!selectedCategorySlug) return [];
		return products.filter((product) => product.categorySlug === selectedCategorySlug).sort((left, right) => compareAlphabetically(left.name, right.name));
	}, [products, selectedCategorySlug]);

	const productsMatchingSearch = useMemo(() => {
		if (!productQuery.trim()) return categoryProducts;
		return categoryProducts.filter((product) => matchesQuery(productSearchHaystack(product), productQuery));
	}, [categoryProducts, productQuery]);

	// Brand options come from the wizard catalog for the selected category.
	// the active category. Counts use `productsMatchingSearch` so they stay
	// honest as the operator narrows the list with search.
	const brandOptions = useMemo<FilterOption[]>(() => {
		if (!selectedCategorySlug) return [];
		const brands = catalog.brandsByCategory[selectedCategorySlug] ?? [];
		return brands.map((brand) => ({
			value: brand.slug,
			label: brand.name,
			count: productsMatchingSearch.filter((product) => product.brand.slug === brand.slug).length,
		}));
	}, [catalog.brandsByCategory, productsMatchingSearch, selectedCategorySlug]);
	const tableRows = useMemo(() => productsMatchingSearch.filter((product) => matchesFilters(product, filters)), [productsMatchingSearch, filters]);

	const filtersActive = hasActiveFilters(filters);

	async function handleDelete() {
		if (!deleteTarget) return;
		const deletedName = deleteTarget.name;
		try {
			await apiFetch(`/api/products/${deleteTarget.id}`, {
				method: "DELETE",
			});
			toast.success(`Deleted "${deletedName}"`);
			// Reset all related state + URL params in ONE replace() call. The
			// previous code called closeDeleteConfirm() + closePanels() back to
			// back, so both used the same memoised `params` snapshot — the
			// second replace resurrected `?delete=ID`, the URL→state effect
			// fired, and the confirm dialog reopened on top of the success
			// toast. One batched patch avoids the race.
			pendingDeleteIdRef.current = null;
			setDeleteTarget(null);
			setEditState(null);
			replace({
				delete: null,
				product: null,
				panel: null,
				vuid: null,
			});
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to delete product.");
		}
	}

	// Cell containers may wrap so content never overflows its column; only the
	// atomic pills/badges and the product name stay on a single line (the name
	// truncates within its 18rem cap). Flags render as icon-only badges next to
	// the name, and stock is one compact cell.
	const tableColumns: TableColumn<AdminProductSummary>[] = [
		{
			id: "product",
			header: "Product",
			sortable: true,
			sortAccessor: (product) => product.name,
			cell: (product) => {
				const productUrl = `${publicUrl}/${product.categorySlug}/${product.slug}`;

				return (
					<div className="flex min-w-0 items-center gap-3">
						<ProductThumb product={product} />
						<div className="flex min-w-0 max-w-[18rem] flex-col py-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate text-xs font-semibold text-[var(--color-ink-900)]" title={product.name || "Untitled product"}>
									{product.name || "Untitled product"}
								</span>
								<a
									href={productUrl}
									target="_blank"
									rel="noopener noreferrer"
									title="Open in storefront"
									className="shrink-0 rounded p-0.5 text-[var(--color-ink-400)] transition-colors hover:text-[var(--color-accent-700)]"
								>
									<ExternalLink size={12} strokeWidth={2.2} aria-hidden />
								</a>
								{product.isFeatured ? (
									<ProductFlagBadge label="Featured" tone="dark">
										<Star size={10} strokeWidth={2.4} />
									</ProductFlagBadge>
								) : null}
								{!product.isActive ? (
									<ProductFlagBadge label="Disabled on storefront" tone="warn">
										<EyeOff size={10} strokeWidth={2.4} />
									</ProductFlagBadge>
								) : null}
							</div>
							<div className="flex items-center gap-2">
								<span className="truncate text-[11px] text-[var(--color-ink-500)]">
									{product.brand.name || product.brand.slug || "No Brand"} • {product.categorySlug}
								</span>
								{product.seoScore !== undefined && (
									<span
										className={classNames(
											"rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums whitespace-nowrap shrink-0",
											seoScoreTone(product.seoScore) === "success"
												? "bg-emerald-100 text-emerald-800"
												: seoScoreTone(product.seoScore) === "warn"
													? "bg-amber-100 text-amber-800"
													: "bg-rose-100 text-rose-800",
										)}
										title="SEO Score"
									>
										SEO: {product.seoScore}
									</span>
								)}
							</div>
						</div>
					</div>
				);
			},
		},
		{
			id: "stock",
			header: "Stock",
			hideOnMobile: true,
			width: "7rem",
			sortable: true,
			// No-variants sort last; otherwise sort by raw in-stock count and use
			// total variant count as a tiebreaker so identical in-stock numbers
			// stay ordered by catalog size rather than randomly.
			sortAccessor: (product) => (product.variantCount === 0 ? -1 : product.inStockCount + product.variantCount * 0.001),
			cell: (product) => <ProductStockCell product={product} />,
		},
		{
			id: "price",
			header: "Price",
			width: "9rem",
			sortable: true,
			sortAccessor: (product) => product.minPriceRupees ?? 0,
			cell: (product) => {
				if (product.minPriceRupees === undefined) {
					return <span className="whitespace-nowrap text-xs font-semibold text-[var(--color-ink-900)]">—</span>;
				}

				const hasRange = product.maxPriceRupees !== undefined && product.maxPriceRupees > product.minPriceRupees;

				return (
					<div className="flex flex-col items-center">
						<span className="whitespace-nowrap text-xs font-semibold tabular-nums text-[var(--color-ink-900)]">{formatPrice(product.minPriceRupees)}</span>
						{hasRange && <span className="whitespace-nowrap text-[10px] tabular-nums text-[var(--color-ink-500)]">– {formatPrice(product.maxPriceRupees!)}</span>}
					</div>
				);
			},
		},
		{
			id: "storefront",
			header: "Live",
			hideOnMobile: true,
			width: "3.5rem",
			cell: (product) => (
				<div className="flex justify-center">
					<ProductVisibilityToggle productId={product.id} productName={product.name} isActive={product.isActive} onUpdated={() => router.refresh()} />
				</div>
			),
		},
		{
			id: "actions",
			header: "Actions",
			cell: (product) => (
				<ProductRowEditMenu
					canUpdate={canUpdate}
					canDelete={canDelete}
					onEditProduct={() => openEdit(product.id, "details")}
					onManageVariants={() => openEdit(product.id, "variants")}
					onEditSeo={() => openEdit(product.id, "seo")}
					onDelete={() => openDeleteConfirm(product)}
				/>
			),
		},
	];

	return (
		<>
			<WorkspaceFrame minHeight={false}>
				{!canUpdate ? <WorkspaceReadOnlyBanner message="Read-only — you can browse products but not edit listings or variants." /> : null}
				<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
					<CategorySidebar
						items={filteredCategoryNav}
						selectedSlug={selectedCategorySlug}
						onSelect={selectCategory}
						categoryQuery={categoryQuery}
						onCategoryQueryChange={setCategoryQueryUrl}
						isFiltered={categoryQuery.trim().length > 0}
					/>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						<WorkspaceCatalogPaneHeader
							title={
								selectedNav ? (
									<div className="flex min-w-0 items-center gap-1.5">
										<LucideIconRenderer name={selectedNav.category.icon} size={14} strokeWidth={2.2} className="shrink-0 text-[var(--color-accent-700)]" aria-hidden />
										<h2 className="truncate text-xs font-semibold text-[var(--color-ink-900)]">{selectedNav.category.label}</h2>
									</div>
								) : (
									<h2 className="text-xs font-semibold text-[var(--color-ink-900)]">Products</h2>
								)
							}
							subtitle={selectedNav ? `${tableRows.length} shown · ${selectedNav.totalCount} total${filtersActive ? " · filtered" : ""}` : "Select a category to manage products."}
							search={
								<CatalogSearchField
									value={productQuery}
									onChange={setProductQueryUrl}
									placeholder="Search products…"
									aria-label="Search products"
									className="min-w-0 flex-1 sm:max-w-[14rem] sm:flex-none"
								/>
							}
							action={
								canCreate ? (
									<Suspense fallback={null}>
										<ProductCreateWizard catalog={catalog} variant="toolbar" />
									</Suspense>
								) : undefined
							}
							filters={
								<>
									<FilterDropdown label="Brand" options={brandOptions} selected={filters.brands} onChange={(brands) => updateFilters({ brands })} />
									<FilterDropdown
										label="Stock"
										single
										options={STOCK_OPTIONS}
										selected={filters.stock === "all" ? [] : [filters.stock]}
										onChange={(values) =>
											updateFilters({
												stock: (values[0] as StockFilter | undefined) ?? "all",
											})
										}
									/>
									<FilterDropdown
										label="Status"
										single
										options={STATUS_OPTIONS}
										selected={filters.status === "all" ? [] : [filters.status]}
										onChange={(values) =>
											updateFilters({
												status: (values[0] as StatusFilter | undefined) ?? "all",
											})
										}
									/>
									<FilterDropdown
										label="Featured"
										single
										options={FEATURED_OPTIONS}
										selected={filters.featured === "all" ? [] : [filters.featured]}
										onChange={(values) =>
											updateFilters({
												featured: (values[0] as FeaturedFilter | undefined) ?? "all",
											})
										}
									/>
									<FilterDropdown
										label="Photos"
										single
										options={PHOTOS_OPTIONS}
										selected={filters.photos === "all" ? [] : [filters.photos]}
										onChange={(values) =>
											updateFilters({
												photos: (values[0] as PhotosFilter | undefined) ?? "all",
											})
										}
									/>
									{filtersActive ? (
										<button
											type="button"
											onClick={clearFilters}
											className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold text-[var(--color-ink-500)] underline-offset-2 hover:text-[var(--color-ink-900)] hover:underline"
										>
											Clear filters
										</button>
									) : null}
								</>
							}
						/>

						<div className="flex min-h-0 flex-1 flex-col p-2 [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none [&_table]:text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-[10px]">
							<Table
								fillHeight
								rows={tableRows}
								columns={tableColumns}
								rowKey={(product) => product.id}
								emptyState={
									products.length === 0
										? canCreate
											? "No products yet. Click New product to add one."
											: "No products yet."
										: productQuery.trim() || filtersActive
											? "No products match your search or filters."
											: "No products in this category."
								}
							/>
						</div>
					</div>
				</div>
			</WorkspaceFrame>

			{editDrawerMounted && editState ? (
				<ProductEditDrawer productId={editState.productId} step={PANEL_TO_STEP[editState.panel]} catalog={catalog} isOpen onClose={closePanels} onSaved={() => router.refresh()} />
			) : null}

			<ConfirmDialog
				isOpen={deleteTarget !== null}
				title="Delete product?"
				message={
					<>
						Permanently delete <strong>{deleteTarget?.name}</strong> and all its variants?
					</>
				}
				tone="danger"
				confirmLabel="Delete"
				onConfirm={handleDelete}
				onCancel={closeDeleteConfirm}
			/>
		</>
	);
}

function CategorySidebar({
	items,
	selectedSlug,
	onSelect,
	categoryQuery,
	onCategoryQueryChange,
	isFiltered,
}: {
	items: CategoryNavItem[];
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	categoryQuery: string;
	onCategoryQueryChange: (value: string) => void;
	isFiltered: boolean;
}) {
	return (
		<>
			<aside className="hidden w-44 shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:border-b-0 lg:border-r xl:w-48">
				<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
					Categories
					{isFiltered && items.length > 0 ? <span className="ml-1 font-medium normal-case tracking-normal text-[var(--color-ink-400)]">({items.length})</span> : null}
				</p>
				<CatalogSearchField value={categoryQuery} onChange={onCategoryQueryChange} placeholder="Search…" aria-label="Search categories" className="mb-2 w-full shrink-0" />
				<nav aria-label="Product categories" className="-mx-1 flex-1 overflow-y-auto">
					{items.length === 0 ? (
						<p className="px-2 py-3 text-[11px] text-[var(--color-ink-500)]">No categories match your search.</p>
					) : (
						<ul className="reveal-stagger flex flex-col gap-0.5">
							{items.map(({ category, totalCount }) => {
								const isSelected = category.slug === selectedSlug;

								return (
									<li key={category.slug} className="reveal">
										<button
											type="button"
											onClick={() => onSelect(category.slug)}
											className={classNames(
												"flex w-full items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-xs transition-colors",
												isSelected
													? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-900)]"
													: "text-[var(--color-ink-700)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink-900)]",
											)}
										>
											<LucideIconRenderer name={category.icon} size={13} strokeWidth={2.2} className="shrink-0" aria-hidden />
											<span className="min-w-0 flex-1 truncate">{category.label}</span>
											<span
												className={classNames(
													"shrink-0 rounded-full px-1 py-0.5 text-[9px] font-semibold tabular-nums",
													isSelected ? "bg-[var(--color-accent-200)] text-[var(--color-accent-900)]" : "bg-[var(--color-ink-100)] text-[var(--color-ink-600)]",
												)}
											>
												{totalCount}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</nav>
			</aside>

			<div className="shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2 lg:hidden">
				<CatalogSearchField value={categoryQuery} onChange={onCategoryQueryChange} placeholder="Search categories…" aria-label="Search categories" className="mb-2 w-full" />
				<nav aria-label="Product categories" className="reveal-stagger -mx-1 flex gap-1 overflow-x-auto">
					{items.length === 0 ? (
						<p className="px-1 text-[11px] text-[var(--color-ink-500)]">No categories match.</p>
					) : (
						items.map(({ category, totalCount }) => {
							const isSelected = category.slug === selectedSlug;

							return (
								<button
									key={category.slug}
									type="button"
									onClick={() => onSelect(category.slug)}
									className={classNames(
										"reveal inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
										isSelected
											? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-900)]"
											: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)]",
									)}
								>
									<LucideIconRenderer name={category.icon} size={12} strokeWidth={2.2} aria-hidden />
									{category.label}
									<span className="tabular-nums text-[9px] opacity-80">{totalCount}</span>
								</button>
							);
						})
					)}
				</nav>
			</div>
		</>
	);
}

function ProductVisibilityToggle({
	productId,
	productName,
	isActive: initialActive,
	onUpdated,
}: {
	productId: string;
	productName: string;
	isActive: boolean;
	onUpdated: () => void;
}) {
	const toast = useToast();
	const [isActive, setIsActive] = useState(initialActive);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		scheduleStateUpdate(() => {
			setIsActive(initialActive);
		});
	}, [initialActive, productId]);

	async function handleToggle() {
		const next = !isActive;
		setSaving(true);
		try {
			await apiFetch(`/api/products/${productId}`, {
				method: "PUT",
				json: { isActive: next },
			});
			setIsActive(next);
			toast.success(next ? `"${productName}" is visible on the storefront` : `"${productName}" is hidden from the storefront`);
			onUpdated();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to update product visibility.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Toggle
			checked={isActive}
			onCheckedChange={() => void handleToggle()}
			isLoading={saving}
			aria-label={isActive ? `Disable ${productName} on storefront` : `Enable ${productName} on storefront`}
		/>
	);
}

function ProductThumb({ product }: { product: AdminProductSummary }) {
	if (product.heroImage) {
		return (
			<Image
				src={product.heroImage.variants.thumb}
				alt={product.heroImage.alt || product.name}
				width={32}
				height={32}
				className="size-8 shrink-0 rounded-[var(--radius-md)] object-cover"
			/>
		);
	}
	return (
		<span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">
			{getInitials(product.brand.name || product.name)}
		</span>
	);
}

/**
 * Inline single-row flag for the products table — small enough that
 * Featured + Disabled markers can sit next to the product name without
 * pushing the row to wrap. Icon-only at this size; the readable label
 * lives in `title` for screen readers and hover.
 */
function ProductFlagBadge({ label, tone, children }: { label: string; tone: "dark" | "warn"; children: React.ReactNode }) {
	return (
		<span
			title={label}
			aria-label={label}
			className={classNames(
				"inline-grid size-4 shrink-0 place-items-center rounded-[var(--radius-sm)]",
				tone === "dark" ? "bg-[var(--color-ink-900)] text-white" : "bg-amber-100 text-amber-800",
			)}
		>
			{children}
		</span>
	);
}

function ProductStockCell({ product }: { product: AdminProductSummary }) {
	if (product.variantCount === 0) {
		return <span className="whitespace-nowrap text-[11px] text-[var(--color-ink-400)]">No variants</span>;
	}
	return (
		<div className="flex flex-col items-center">
			<span className="whitespace-nowrap text-xs font-semibold tabular-nums text-[var(--color-ink-900)]">{product.totalStockQuantity} items</span>
			<span className="whitespace-nowrap text-[10px] text-[var(--color-ink-500)]">
				in {product.inStockCount} of {product.variantCount} variants
			</span>
		</div>
	);
}
