import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { classNames, formatAttributeOptionLabel } from "@store/shared";

import { CatalogSearchField } from "@/components/shared/catalogWorkspaceUi";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import type { AdminAttribute } from "@/types/models";

import type { CategoryNavItem, WorkspaceView } from "./categoriesCatalogTypes";

export function AttributeOptionsCell({ attribute }: { attribute: AdminAttribute }) {
	const maxVisible = 4;
	const { options, unit } = attribute;

	if (options.length === 0) {
		return <span className="text-[11px] italic text-[var(--color-ink-400)]">No options</span>;
	}

	const visible = options.slice(0, maxVisible);
	const overflow = options.length - visible.length;

	return (
		<div className="flex max-w-[16rem] flex-wrap items-center gap-1">
			{visible.map((opt) => {
				const label = formatAttributeOptionLabel(opt.label, unit);
				return (
					<span
						key={opt.value}
						className="inline-flex max-w-full truncate items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-800)]"
					>
						{label}
					</span>
				);
			})}
			{overflow > 0 ? <span className="text-[10px] font-medium text-[var(--color-ink-500)]">+{overflow} more</span> : null}
		</div>
	);
}

export function CategorySidebar({
	items,
	selectedSlug,
	onSelect,
	categoryQuery,
	onCategoryQueryChange,
	isFiltered,
	viewMode,
	onOpenCardView,
	onOpenTableView,
}: {
	items: CategoryNavItem[];
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	categoryQuery: string;
	onCategoryQueryChange: (value: string) => void;
	isFiltered: boolean;
	viewMode: WorkspaceView;
	onOpenCardView: () => void;
	onOpenTableView: () => void;
}) {
	return (
		<>
			<aside className="hidden w-44 shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:border-b-0 lg:border-r xl:w-48">
				<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
					Categories
					{isFiltered && items.length > 0 ? <span className="ml-1 font-medium normal-case tracking-normal text-[var(--color-ink-400)]">({items.length})</span> : null}
				</p>
				<CatalogSearchField value={categoryQuery} onChange={onCategoryQueryChange} placeholder="Search…" aria-label="Search categories" className="mb-2 w-full shrink-0" />
				<nav aria-label="Categories" className="-mx-1 min-h-0 flex-1 overflow-y-auto">
					{items.length === 0 ? (
						<p className="px-2 py-3 text-[11px] text-[var(--color-ink-500)]">No categories match your search.</p>
					) : (
						<ul className="flex flex-col gap-0.5">
							{items.map(({ category, brandCount, attributeCount }) => {
								const isSelected = category.slug === selectedSlug;
								const total = brandCount + attributeCount;
								return (
									<li key={category.id}>
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
												{total}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</nav>
				<div className="mt-2">
					{viewMode === "tables" ? (
						<button
							type="button"
							onClick={onOpenCardView}
							className="inline-flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[11px] font-semibold text-[var(--color-ink-700)] transition-colors hover:border-[var(--color-accent-400)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-800)]"
						>
							Manage categories
						</button>
					) : (
						<button
							type="button"
							onClick={onOpenTableView}
							className="inline-flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent-300)] bg-[var(--color-accent-50)] text-[11px] font-semibold text-[var(--color-accent-800)] transition-colors hover:bg-[var(--color-accent-100)]"
						>
							Back to catalog
						</button>
					)}
				</div>
			</aside>

			<div className="shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2 lg:hidden">
				<div className="mb-2">
					{viewMode === "tables" ? (
						<button
							type="button"
							onClick={onOpenCardView}
							className="inline-flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[11px] font-semibold text-[var(--color-ink-700)]"
						>
							Manage categories
						</button>
					) : (
						<button
							type="button"
							onClick={onOpenTableView}
							className="inline-flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent-300)] bg-[var(--color-accent-50)] text-[11px] font-semibold text-[var(--color-accent-800)]"
						>
							Back to catalog
						</button>
					)}
				</div>
				<CatalogSearchField value={categoryQuery} onChange={onCategoryQueryChange} placeholder="Search categories…" aria-label="Search categories" className="mb-2 w-full" />
				<nav aria-label="Categories" className="-mx-1 flex gap-1 overflow-x-auto">
					{items.length === 0 ? (
						<p className="px-1 text-[11px] text-[var(--color-ink-500)]">No categories.</p>
					) : (
						items.map(({ category, brandCount, attributeCount }) => {
							const isSelected = category.slug === selectedSlug;
							const total = brandCount + attributeCount;
							return (
								<button
									key={category.id}
									type="button"
									onClick={() => onSelect(category.slug)}
									className={classNames(
										"inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
										isSelected
											? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-900)]"
											: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)]",
									)}
								>
									<LucideIconRenderer name={category.icon} size={12} strokeWidth={2.2} aria-hidden />
									{category.label}
									<span className="tabular-nums text-[9px] opacity-80">{total}</span>
								</button>
							);
						})
					)}
				</nav>
			</div>
		</>
	);
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
	return (
		<div className="flex flex-nowrap whitespace-nowrap justify-end gap-1.5">
			<button
				type="button"
				onClick={onEdit}
				className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-canvas-deep)]"
			>
				<Pencil size={13} aria-hidden />
				<span className="hidden md:inline">Edit</span>
			</button>
			<button
				type="button"
				onClick={onDelete}
				className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-rose-200)] px-2 py-1 text-[11px] font-semibold text-[var(--color-rose-700)] transition-colors hover:bg-[var(--color-rose-50)]"
			>
				<Trash2 size={13} aria-hidden />
				<span className="hidden md:inline">Delete</span>
			</button>
		</div>
	);
}

export function IconButton({
	label,
	onClick,
	icon,
	disabled = false,
	tone = "default",
}: {
	label: string;
	onClick: () => void;
	icon: ReactNode;
	disabled?: boolean;
	tone?: "default" | "danger";
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className={classNames(
				"grid size-7 place-items-center rounded-[var(--radius-md)] transition-colors disabled:opacity-40",
				tone === "danger"
					? "text-[var(--color-rose-600)] hover:bg-[var(--color-rose-50)]"
					: "text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
			)}
		>
			{icon}
		</button>
	);
}
