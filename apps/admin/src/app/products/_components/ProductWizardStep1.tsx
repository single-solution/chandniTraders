"use client";

import { useMemo, useState } from "react";
import { slugify, type ProductAttributeConfig } from "@store/shared";

import { Button } from "@store/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { uploadGalleryImages } from "@/components/shared/uploads/imageStaging";
import type { GalleryImage } from "@/components/shared/uploads/imageStaging";
import type { AdminProduct } from "@/types/models";
import type { ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";

import { collectProductImageErrors, emptyDraft, errorsByPath, validateShellDraft, type CategorySurface, type ProductDraft, type ProductValidationError } from "./productFormState";
import { ProductDetailsForm } from "./ProductDetailsForm";
import { attributeConfigForCategory, buildAttributeConfigForSave } from "./productAttributeConfigState";

interface ProductWizardStep1Props {
	onClose: () => void;
	catalog: ProductWizardCatalog;
	onCreated: (product: AdminProduct) => void;
}

export function ProductWizardStep1({ onClose, catalog, onCreated }: ProductWizardStep1Props) {
	const toast = useToast();
	const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
	const [errors, setErrors] = useState<ProductValidationError[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [attributeConfig, setAttributeConfig] = useState<ProductAttributeConfig>({
		attributeSlugs: [],
		attributeOptionPool: {},
	});

	const surface: CategorySurface | null = useMemo(() => {
		if (!draft.categorySlug) return null;
		const category = catalog.categories.find((cat) => cat.slug === draft.categorySlug);
		if (!category) return null;
		return {
			category,
			brands: catalog.brandsByCategory[draft.categorySlug] ?? [],
			attributes: catalog.attributesByCategory[draft.categorySlug] ?? [],
		};
	}, [draft.categorySlug, catalog]);

	const errorMap = useMemo(() => errorsByPath(errors), [errors]);
	const slugHint = useMemo(() => (draft.name ? slugify(draft.name) : ""), [draft.name]);

	function setCategory(categorySlug: string) {
		if (categorySlug === draft.categorySlug) return;
		const attrs = catalog.attributesByCategory[categorySlug] ?? [];
		setDraft({ ...emptyDraft(), categorySlug });
		setAttributeConfig(attributeConfigForCategory(attrs));
		setErrors([]);
	}

	function handleClose() {
		if (submitting) return;
		setDraft(emptyDraft());
		setErrors([]);
		onClose();
	}

	function updateImages(images: GalleryImage[]) {
		setDraft((prev) => ({ ...prev, images }));
		setErrors((prev) => prev.filter((row) => row.path !== "images"));
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!form.reportValidity()) return;
		if (submitting) return;
		const shell = validateShellDraft(draft);
		const imageErrors = collectProductImageErrors(draft.images);
		if (!shell.ok || imageErrors.length > 0) {
			const merged = [...(shell.ok ? [] : shell.errors), ...imageErrors];
			setErrors(merged);
			toast.danger(merged.length === 1 ? merged[0].message : `${merged.length} fields need attention.`);
			return;
		}
		setErrors([]);
		setSubmitting(true);
		try {
			const uploadedImages = await uploadGalleryImages(draft.images, {
				subjectKind: "products/new",
				subjectId: shell.payload.brandSlug ? `${shell.payload.categorySlug}-${shell.payload.brandSlug}-${slugHint || "draft"}` : "draft",
			});
			const product = await apiFetch<AdminProduct>("/api/products", {
				method: "POST",
				json: { ...shell.payload, images: uploadedImages, variants: [], isActive: false },
			});
			const configured = await apiFetch<AdminProduct>(`/api/products/${product.id}`, {
				method: "PUT",
				json: buildAttributeConfigForSave(attributeConfig, surface?.attributes ?? []),
			});
			toast.success("Product saved. Add variations next, or skip for now.");
			setDraft(emptyDraft());
			setErrors([]);
			onCreated(configured);
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to create product.";
			toast.danger(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<form id="product-wizard-step1" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<ProductDetailsForm
					name={draft.name}
					onNameChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
					slugHint={slugHint}
					categories={catalog.categories}
					categorySlug={draft.categorySlug}
					onCategorySelect={setCategory}
					brands={surface?.brands ?? []}
					brandSlug={draft.brandSlug}
					onBrandSelect={(slug) => setDraft((prev) => ({ ...prev, brandSlug: slug }))}
					showBrandPicker={Boolean(surface)}
					images={draft.images}
					onImagesChange={updateImages}
					imagesAltBase={draft.name || "Product"}
					showPhotos={Boolean(surface)}
					categoryAttributes={surface?.attributes ?? []}
					attributeConfig={attributeConfig}
					onAttributeConfigChange={setAttributeConfig}
					showAttributes={Boolean(surface)}
					errorMap={errorMap}
				/>
			</form>

			<div className="safe-bottom shrink-0 border-t border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 py-3 md:px-5 md:py-4">
				<div className="flex items-center justify-between gap-2">
					<div className="text-sm font-medium text-[var(--color-ink-500)]">Step 1 of 2</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" type="button" onClick={handleClose} disabled={submitting}>
							Cancel
						</Button>
						<Button variant="primary" size="sm" type="submit" form="product-wizard-step1" isLoading={submitting}>
							Save &amp; continue
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
