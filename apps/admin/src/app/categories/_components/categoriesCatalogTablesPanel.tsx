import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";

import { Table } from "@/components/ui/Table";
import { CatalogSearchField, CatalogTabChip } from "@/components/shared/catalogWorkspaceUi";
import { WorkspacePrimaryAction } from "@/components/shared/workspaceUi";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";
import type { CatalogDrawerState } from "@/lib/url/catalogDrawerUrl";

import { buildAttributeColumns, buildBrandColumns } from "./categoriesCatalogColumns";
import { CatalogVisibilityToggle } from "./CatalogVisibilityToggle";
import type { CatalogTab, CategoryNavItem, DeleteIntent } from "./categoriesCatalogTypes";
import { IconButton } from "./categoriesCatalogUi";

export interface CategoriesCatalogTablesPanelProps {
	categories: AdminCategory[];
	selectedNav: CategoryNavItem | undefined;
	selectedCategory: AdminCategory | null;
	activeTab: CatalogTab;
	setActiveTab: (tab: CatalogTab) => void;
	rowQuery: string;
	setRowQuery: (query: string) => void;
	setRowQueryUrl: (query: string) => void;
	setTabUrl: (tab: CatalogTab) => void;
	filteredBrands: AdminBrand[];
	filteredAttributes: AdminAttribute[];
	newButtonLabel: string;
	rowSearchPlaceholder: string;
	openCreateForTab: () => void;
	moveCategory: (category: AdminCategory, direction: -1 | 1) => Promise<void>;
	openDrawerUrl: (next: CatalogDrawerState) => void;
	openDeleteUrl: (intent: DeleteIntent) => void;
}

export function CategoriesCatalogTablesPanel({
	categories,
	selectedNav,
	selectedCategory,
	activeTab,
	setActiveTab,
	rowQuery,
	setRowQuery,
	setRowQueryUrl,
	setTabUrl,
	filteredBrands,
	filteredAttributes,
	newButtonLabel,
	rowSearchPlaceholder,
	openCreateForTab,
	moveCategory,
	openDrawerUrl,
	openDeleteUrl,
}: CategoriesCatalogTablesPanelProps) {
	const columnHandlers = {
		selectedCategory,
		openDrawerUrl,
		openDeleteUrl,
	};

	const brandColumns = buildBrandColumns(columnHandlers);
	const attributeColumns = buildAttributeColumns(columnHandlers);

	const categoryIndex = selectedCategory ? categories.findIndex((row) => row.id === selectedCategory.id) : -1;

	return (
		<>
			<header className="shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2">
				<div className="flex flex-wrap items-center gap-2">
					{selectedNav ? (
						<div className="flex min-w-0 flex-1 items-center gap-1.5 sm:mr-auto">
							<LucideIconRenderer name={selectedNav.category.icon} size={14} strokeWidth={2.2} className="shrink-0 text-[var(--color-accent-700)]" aria-hidden />
							<div className="min-w-0">
								<h2 className="truncate text-xs font-semibold text-[var(--color-ink-900)]">{selectedNav.category.label}</h2>
								<p className="text-[10px] text-[var(--color-ink-500)]">
									{activeTab === "brands" ? filteredBrands.length : filteredAttributes.length} shown · slug {selectedNav.category.slug}
								</p>
							</div>
							<div className="ml-1 flex shrink-0 items-center gap-0.5">
								<span className="mr-0.5" title={selectedNav.category.isActive ? "Live on storefront" : "Hidden from storefront"}>
									<CatalogVisibilityToggle endpoint={`/api/categories/${selectedNav.category.id}`} label={selectedNav.category.label} isActive={selectedNav.category.isActive} />
								</span>
								<IconButton label="Move category up" disabled={categoryIndex <= 0} onClick={() => moveCategory(selectedNav.category, -1)} icon={<ChevronUp size={13} />} />
								<IconButton
									label="Move category down"
									disabled={categoryIndex < 0 || categoryIndex >= categories.length - 1}
									onClick={() => moveCategory(selectedNav.category, 1)}
									icon={<ChevronDown size={13} />}
								/>
								<IconButton
									label="Edit category"
									onClick={() =>
										openDrawerUrl({
											kind: "category",
											category: selectedNav.category,
										})
									}
									icon={<Pencil size={13} />}
								/>
								<IconButton
									label="Delete category"
									tone="danger"
									onClick={() =>
										openDeleteUrl({
											kind: "category",
											id: selectedNav.category.id,
											label: selectedNav.category.label,
										})
									}
									icon={<Trash2 size={13} />}
								/>
							</div>
						</div>
					) : (
						<p className="text-xs text-[var(--color-ink-500)] sm:mr-auto">Select a category</p>
					)}

					<div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-nowrap">
						<CatalogSearchField
							value={rowQuery}
							onChange={setRowQueryUrl}
							placeholder={rowSearchPlaceholder}
							aria-label={rowSearchPlaceholder}
							className="min-w-0 flex-1 sm:max-w-[14rem] sm:flex-none"
						/>
						<WorkspacePrimaryAction iconElement={<Plus size={14} />} label={newButtonLabel} onClick={openCreateForTab} disabled={!selectedCategory} />
					</div>
				</div>

				<div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Catalog sections">
					<CatalogTabChip
						label="Brands"
						count={selectedNav?.brandCount ?? 0}
						isActive={activeTab === "brands"}
						onClick={() => {
							setActiveTab("brands");
							setRowQuery("");
							setTabUrl("brands");
						}}
					/>
					<CatalogTabChip
						label="Attributes"
						count={selectedNav?.attributeCount ?? 0}
						isActive={activeTab === "attributes"}
						onClick={() => {
							setActiveTab("attributes");
							setRowQuery("");
							setTabUrl("attributes");
						}}
					/>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-2 [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none [&_table]:text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-[10px]">
				{categories.length === 0 ? (
					<div className="px-4 py-12 text-center text-sm text-[var(--color-ink-500)]">
						No categories yet. Switch to Manage categories below to create your first storefront category.
					</div>
				) : (
					<>
						{activeTab === "brands" ? (
							<Table
								rows={filteredBrands}
								columns={brandColumns}
								rowKey={(row) => row.id}
								emptyState={!selectedCategory ? "Select a category from the sidebar." : rowQuery.trim() ? "No items match your search." : "No brands in this category yet."}
							/>
						) : null}
						{activeTab === "attributes" ? (
							<Table
								rows={filteredAttributes}
								columns={attributeColumns}
								rowKey={(row) => row.id}
								emptyState={!selectedCategory ? "Select a category from the sidebar." : rowQuery.trim() ? "No items match your search." : "No attributes in this category yet."}
							/>
						) : null}
					</>
				)}
			</div>
		</>
	);
}
