"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { SeoMeta } from "@store/shared";

import { slugify } from "@store/shared";

import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { CatalogSeoPanel } from "@/app/settings/_components/CatalogSeoPanel";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { BRAND_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import type { AdminBrand, AdminCategory } from "@/types/models";

import { PreviewPanel } from "./previewPanel";
import { BrandChipPreview, BrandFilterRowPreview, type BrandDraft } from "./previews";

interface BrandEditorProps {
	isOpen: boolean;
	onClose: () => void;
	/** Existing brand for edit mode, or `null` to create. */
	brand: AdminBrand | null;
	/** Category this brand is being authored under. */
	category: AdminCategory;
	/** Pre-existing brands in this category, for sibling neighbour preview. */
	siblings: AdminBrand[];
	onSaved: () => void;
}

interface FormState {
	name: string;
	isActive: boolean;
	seo: SeoMeta;
}

function emptyForm(): FormState {
	return { name: "", isActive: true, seo: {} };
}

function formFromBrand(brand: AdminBrand): FormState {
	return {
		name: brand.name,
		isActive: brand.isActive,
		seo: brand.seo ?? {},
	};
}

export function BrandEditor({ isOpen, onClose, brand, category, siblings, onSaved }: BrandEditorProps) {
	const toast = useToast();
	const [form, setForm] = useState<FormState>(() => (brand ? formFromBrand(brand) : emptyForm()));
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form on drawer open; the drawer is the external system here
		setForm(brand ? formFromBrand(brand) : emptyForm());
	}, [isOpen, brand]);

	const deferredForm = useDeferredValue(form);
	const draft: BrandDraft = useMemo(() => ({ name: deferredForm.name, isActive: deferredForm.isActive }), [deferredForm]);
	const siblingNames = useMemo(() => siblings.filter((sibling) => !brand || sibling.id !== brand.id).map((sibling) => sibling.name), [siblings, brand]);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (submitting) return;
		if (!form.name.trim()) {
			toast.danger("Brand name is required.");
			return;
		}
		setSubmitting(true);
		try {
			if (brand) {
				const categorySlugs = brand.categorySlugs.includes(category.slug) ? brand.categorySlugs : [...brand.categorySlugs, category.slug];
				await apiFetch<AdminBrand>(`/api/brands/${brand.id}`, {
					method: "PUT",
					json: {
						name: form.name.trim(),
						categorySlugs,
						isActive: form.isActive,
						seo: form.seo,
					},
				});
				toast.success("Brand updated.");
			} else {
				await apiFetch<AdminBrand>("/api/brands", {
					method: "POST",
					json: {
						name: form.name.trim(),
						categorySlugs: [category.slug],
						isActive: form.isActive,
						seo: form.seo,
					},
				});
				toast.success("Brand created.");
			}
			onSaved();
			onClose();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to save brand.";
			toast.danger(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title={brand ? `Edit · ${brand.name}` : `New brand · ${category.label}`}
			description="Brands carry only a name. They surface as a chip on cards and as a filter row in the sidebar."
			width="lg"
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button variant="primary" size="sm" type="submit" form="brand-editor-form" isLoading={submitting}>
						{brand ? "Save changes" : "Add brand"}
					</Button>
				</div>
			}
		>
			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
				<form id="brand-editor-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div>
						<label htmlFor="brand-name" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
							Name
						</label>
						<input
							id="brand-name"
							type="text"
							value={form.name}
							onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
							maxLength={BRAND_FIELD_LIMITS.name}
							required
							placeholder="e.g. Brand name"
							autoComplete="off"
							className="block w-full rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[14px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none"
						/>
					</div>
					<p className="rounded-md bg-[var(--color-canvas-deep)] px-3 py-2 text-[12px] text-[var(--color-ink-500)]">
						Brands list alphabetically on the storefront and in the admin — no manual sort order.
					</p>
					{brand != null && brand.categorySlugs.length > 1 && (
						<p className="rounded-md bg-[var(--color-accent-50)] px-3 py-2 text-[12px] text-[var(--color-accent-800)]">
							This brand is shared with {brand.categorySlugs.length - 1} other categories. Editing here updates all of them.
						</p>
					)}
					<CatalogSeoPanel
						value={form.seo}
						onChange={(seo) => setForm((prev) => ({ ...prev, seo }))}
						contextLabel={form.name ? `Brand · ${form.name}` : "Brand"}
						entity={{
							type: "brand",
							entity: {
								slug: brand?.slug ?? (slugify(form.name) || "preview"),
								name: form.name,
							},
						}}
					/>
				</form>
				<PreviewPanel
					tiles={[
						{
							surfaceLabel: "Appears on: Product card chip",
							body: <BrandChipPreview brand={draft} />,
						},
						{
							surfaceLabel: "Appears on: Filter sidebar",
							body: <BrandFilterRowPreview brand={draft} siblingNames={siblingNames} />,
						},
					]}
				/>
			</div>
		</Drawer>
	);
}
