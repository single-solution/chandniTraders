"use client";

/**
 * Drawer-based editor for a single category. Used in both create and
 * edit modes. Right-hand pane is a live preview that updates as the
 * admin types (deferred to avoid stalling input).
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { IconName, SeoMeta, StructuredContent } from "@store/shared";

import { DEFAULT_ICON, emptyStructuredContent, normalizeStructuredContent, slugify } from "@store/shared";

import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { StructuredContentEditor } from "@/components/forms/StructuredContentEditor";
import { LucideIconPicker } from "@/components/icons/LucideIconPicker";
import { CatalogSeoPanel } from "@/app/settings/_components/CatalogSeoPanel";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { CATEGORY_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import type { AdminCategory } from "@/types/models";

import { PreviewPanel } from "./previewPanel";
import { CategoryCardPreview, CategoryHeaderPreview, CategoryNavChipPreview, CategoryShopSelectorPreview, type CategoryDraft } from "./previews";

interface CategoryEditorProps {
	isOpen: boolean;
	onClose: () => void;
	/** Existing category for edit mode, or `null` to create. */
	category: AdminCategory | null;
	onSaved: () => void;
}

interface FormState {
	label: string;
	description: string;
	icon: IconName;
	isActive: boolean;
	content: StructuredContent;
	seo: SeoMeta;
}

function emptyForm(): FormState {
	return {
		label: "",
		description: "",
		icon: DEFAULT_ICON,
		isActive: true,
		content: emptyStructuredContent(),
		seo: {},
	};
}

function formFromCategory(category: AdminCategory): FormState {
	return {
		label: category.label,
		description: category.description,
		icon: category.icon,
		isActive: category.isActive,
		content: normalizeStructuredContent(category.content, category.description),
		seo: category.seo ?? {},
	};
}

export function CategoryEditor({ isOpen, onClose, category, onSaved }: CategoryEditorProps) {
	const toast = useToast();
	const [form, setForm] = useState<FormState>(() => (category ? formFromCategory(category) : emptyForm()));
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form on drawer open; the drawer is the external system here
		setForm(category ? formFromCategory(category) : emptyForm());
	}, [isOpen, category]);

	const deferredForm = useDeferredValue(form);
	const draft: CategoryDraft = useMemo(
		() => ({
			label: deferredForm.label,
			description: deferredForm.description,
			icon: deferredForm.icon,
			isActive: deferredForm.isActive,
			content: deferredForm.content,
		}),
		[deferredForm],
	);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (submitting) return;
		if (!form.label.trim()) {
			toast.danger("Label is required.");
			return;
		}
		setSubmitting(true);
		try {
			const body: Record<string, unknown> = {
				label: form.label.trim(),
				description: form.description.trim(),
				icon: form.icon,
				isActive: form.isActive,
				content: form.content,
				seo: form.seo,
			};
			if (category) {
				await apiFetch<AdminCategory>(`/api/categories/${category.id}`, {
					method: "PUT",
					json: body,
				});
				toast.success("Category updated.");
			} else {
				await apiFetch<AdminCategory>("/api/categories", {
					method: "POST",
					json: body,
				});
				toast.success("Category created.");
			}
			onSaved();
			onClose();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to save category.";
			toast.danger(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title={category ? `Edit · ${category.label}` : "New category"}
			description="Define the storefront landing surface and the bucket every brand, grade, and attribute attaches to."
			width="xl"
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button variant="primary" size="sm" type="submit" form="category-editor-form" isLoading={submitting}>
						{category ? "Save changes" : "Create category"}
					</Button>
				</div>
			}
		>
			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
				<form id="category-editor-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
					<Field label="Label" htmlFor="category-label">
						<input
							id="category-label"
							type="text"
							value={form.label}
							onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
							maxLength={CATEGORY_FIELD_LIMITS.label}
							required
							placeholder="e.g. Ceiling Fans, Room Coolers"
							autoComplete="off"
							className="block w-full rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[14px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none"
						/>
					</Field>
					<StructuredContentEditor
						value={form.content}
						onChange={(content) =>
							setForm((prev) => ({
								...prev,
								content,
								description: content.summary.slice(0, CATEGORY_FIELD_LIMITS.description),
							}))
						}
						summaryLabel="Description"
						summaryPlaceholder="Short, customer-facing tagline."
						summaryRows={3}
						maxSummaryLength={CATEGORY_FIELD_LIMITS.description}
						bulletsHint="Optional bullets shown beneath the description on storefront category surfaces."
					/>
					<LucideIconPicker value={form.icon} onChange={(icon) => setForm((prev) => ({ ...prev, icon }))} description="This icon appears on category cards and navigation chips." />
					<CatalogSeoPanel
						value={form.seo}
						onChange={(seo) => setForm((prev) => ({ ...prev, seo }))}
						contextLabel={form.label ? `Category · ${form.label}` : "Category"}
						entity={{
							type: "category",
							entity: {
								slug: category?.slug ?? (slugify(form.label) || "preview"),
								label: form.label,
								description: form.description,
							},
						}}
					/>
				</form>
				<PreviewPanel
					hint="Updates as you type. Mirrors the live storefront surfaces this category powers."
					tiles={[
						{
							surfaceLabel: "Appears on: Homepage category grid",
							body: <CategoryCardPreview category={draft} />,
						},
						{
							surfaceLabel: "Appears on: Shop category selector",
							body: <CategoryShopSelectorPreview category={draft} />,
						},
						{
							surfaceLabel: "Appears on: Category landing header",
							body: <CategoryHeaderPreview category={draft} />,
						},
						{
							surfaceLabel: "Appears on: Nav menu chip",
							body: <CategoryNavChipPreview category={draft} />,
						},
					]}
				/>
			</div>
		</Drawer>
	);
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-1 flex items-baseline justify-between gap-2">
				<label htmlFor={htmlFor} className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
					{label}
				</label>
				{Boolean(hint) && <span className="text-[10.5px] text-[var(--color-ink-400)]">{hint}</span>}
			</div>
			{children}
		</div>
	);
}

export { type CategoryEditorProps };
