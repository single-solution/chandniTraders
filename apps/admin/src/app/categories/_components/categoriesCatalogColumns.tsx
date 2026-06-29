import type { TableColumn } from "@/components/ui/Table";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";
import type { CatalogDrawerState } from "@/lib/url/catalogDrawerUrl";

import { CatalogVisibilityToggle } from "./CatalogVisibilityToggle";
import type { DeleteIntent } from "./categoriesCatalogTypes";
import { AttributeOptionsCell, RowActions } from "./categoriesCatalogUi";

interface CatalogColumnHandlers {
	selectedCategory: AdminCategory | null;
	openDrawerUrl: (next: CatalogDrawerState) => void;
	openDeleteUrl: (intent: DeleteIntent) => void;
}

export function buildBrandColumns({ selectedCategory, openDrawerUrl, openDeleteUrl }: CatalogColumnHandlers): TableColumn<AdminBrand>[] {
	return [
		{
			id: "name",
			header: "Brand",
			sortable: true,
			sortAccessor: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-xs font-semibold text-[var(--color-ink-900)]">{row.name}</p>
					<p className="truncate text-[10px] text-[var(--color-ink-500)]">{row.slug}</p>
				</div>
			),
		},
		{
			id: "status",
			header: "Live",
			hideOnMobile: true,
			cell: (row) => <CatalogVisibilityToggle endpoint={`/api/brands/${row.id}`} label={row.name} isActive={row.isActive} />,
		},
		{
			id: "actions",
			header: "",
			cell: (row) =>
				selectedCategory ? (
					<RowActions
						onEdit={() => openDrawerUrl({ kind: "brand", category: selectedCategory, brand: row })}
						onDelete={() =>
							openDeleteUrl({
								kind: "brand",
								id: row.id,
								label: row.name,
								unlinkFromCategorySlug: selectedCategory.slug,
							})
						}
					/>
				) : null,
		},
	];
}

export function buildAttributeColumns({ selectedCategory, openDrawerUrl, openDeleteUrl }: CatalogColumnHandlers): TableColumn<AdminAttribute>[] {
	return [
		{
			id: "attribute",
			header: "Attribute",
			sortable: true,
			sortAccessor: (row) => row.label,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-xs font-semibold text-[var(--color-ink-900)]">{row.label}</p>
					<p className="truncate text-[10px] text-[var(--color-ink-500)]">{row.slug}</p>
				</div>
			),
		},
		{
			id: "unit",
			header: "Unit",
			hideOnMobile: true,
			cell: (row) =>
				row.unit ? (
					<span className="inline-flex max-w-full items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-700)]">
						<span className="truncate">{row.unit}</span>
					</span>
				) : (
					<span className="text-[11px] text-[var(--color-ink-400)]">—</span>
				),
		},
		{
			id: "options",
			header: "Options",
			hideOnMobile: true,
			cell: (row) => <AttributeOptionsCell attribute={row} />,
		},
		{
			id: "display",
			header: "Display",
			hideOnMobile: true,
			cell: (row) => <span className="text-[11px] capitalize text-[var(--color-ink-600)]">{row.cardPosition.replace("-", " ")}</span>,
		},
		{
			id: "status",
			header: "Live",
			hideOnMobile: true,
			cell: (row) => <CatalogVisibilityToggle endpoint={`/api/attributes/${row.id}`} label={row.label} isActive={row.isActive} />,
		},
		{
			id: "actions",
			header: "",
			cell: (row) =>
				selectedCategory ? (
					<RowActions
						onEdit={() =>
							openDrawerUrl({
								kind: "attribute",
								category: selectedCategory,
								attribute: row,
							})
						}
						onDelete={() =>
							openDeleteUrl({
								kind: "attribute",
								id: row.id,
								label: row.label,
							})
						}
					/>
				) : null,
		},
	];
}
