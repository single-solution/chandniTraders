"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { buildVariantDefaultsFromProductConfig, filterAttributesForProduct, isValidId } from "@store/shared";

import { Button } from "@store/ui";
import { uploadGalleryImages } from "@/components/shared/uploads/imageStaging";
import { apiFetch, ApiError } from "@/lib/api";
import { useUrlParams } from "@/lib/url/useUrlParams";
import { useToast } from "@/components/ui/Toast";
import type { ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";
import type { AdminProduct } from "@/types/models";

import { VariantCard, VariantDetailFooter } from "./VariantCard";
import { VariantSidebarTile } from "./VariantSidebarTile";
import { attributeConfigFromProduct } from "./productAttributeConfigState";
import { WizardEmptyHint } from "./productWizardUi";
import {
	adminVariantToDraft,
	emptyVariantDraft,
	errorsByPath,
	mergeVariantDraftAttributes,
	newVariantUid,
	validateVariantDrafts,
	variantErrorCount,
	variantHasErrors,
	type CategorySurface,
	type ProductValidationError,
	type VariantDraft,
} from "./productFormState";

interface ProductWizardStep2Props {
	product: AdminProduct | null;
	catalog: ProductWizardCatalog;
	onClose: () => void;
	onSkip: () => void;
	onSaved: (product?: AdminProduct) => void;
	/** `wizard` = after create; `manage` = catalog row action. */
	purpose?: "wizard" | "manage";
	/** Standalone catalog drawer — Close + Save only (no wizard stepper). */
	standalone?: boolean;
	stepLabel?: string;
	onBack?: () => void;
	nextLabel?: string;
}

function combinationSignature(variant: VariantDraft): string {
	const merged = mergeVariantDraftAttributes(variant);
	const entries = Object.entries(merged)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([slug, value]) => [slug, Array.isArray(value) ? [...value].sort() : value]);
	return JSON.stringify(entries);
}

export function ProductWizardStep2({
	product,
	catalog,
	onClose,
	onSkip,
	onSaved,
	purpose = "wizard",
	stepLabel = "Step 2 of 2",
	onBack,
	nextLabel,
	standalone = false,
}: ProductWizardStep2Props) {
	const isManage = purpose === "manage";
	const { searchParams, replace } = useUrlParams();
	const workspaceInitProductIdRef = useRef<string | null>(null);
	const toast = useToast();
	const [variants, setVariants] = useState<VariantDraft[]>([]);
	const [selectedVariantUid, setSelectedVariantUid] = useState<string | null>(null);
	const [errors, setErrors] = useState<ProductValidationError[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const surface: CategorySurface | null = useMemo(() => {
		if (!product) return null;
		const category = catalog.categories.find((cat) => cat.slug === product.categorySlug);
		if (!category) return null;
		return {
			category,
			brands: catalog.brandsByCategory[product.categorySlug] ?? [],
			attributes: catalog.attributesByCategory[product.categorySlug] ?? [],
		};
	}, [product, catalog]);

	const attributes = useMemo(() => surface?.attributes ?? [], [surface]);
	const attributeConfig = useMemo(() => (product ? attributeConfigFromProduct(product, attributes) : { attributeSlugs: [], attributeOptionPool: {} }), [product, attributes]);
	const errorMap = useMemo(() => errorsByPath(errors), [errors]);

	const syncVariantWorkspaceUrl = useCallback(
		(variantUid: string | null) => {
			if (!isManage) return;
			replace({ vuid: variantUid }, { historyOnly: true });
		},
		[isManage, replace],
	);

	const resetWorkspace = useCallback(
		(nextProduct: AdminProduct, urlUid: string | null = null) => {
			const built = nextProduct.variants.map((variant) => adminVariantToDraft(variant));
			setVariants(built);
			setErrors([]);
			const uidFromUrl = urlUid && built.some((row) => row.uid === urlUid) ? urlUid : null;
			const variantUid = uidFromUrl ?? built[0]?.uid ?? null;
			setSelectedVariantUid(variantUid);
			syncVariantWorkspaceUrl(variantUid);
		},
		[syncVariantWorkspaceUrl],
	);

	const selectedVariant = variants.find((row) => row.uid === selectedVariantUid);
	const selectedIndex = selectedVariant ? variants.findIndex((row) => row.uid === selectedVariant.uid) : -1;

	useEffect(() => {
		if (!product) {
			workspaceInitProductIdRef.current = null;
			return;
		}
		if (workspaceInitProductIdRef.current === product.id) return;
		workspaceInitProductIdRef.current = product.id;

		const urlUid = isManage ? searchParams.get("vuid") : null;
		resetWorkspace(product, urlUid);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [product?.id, catalog, resetWorkspace, isManage]);

	function addVariant() {
		const uid = newVariantUid();
		const defaults = buildVariantDefaultsFromProductConfig(attributeConfig);
		setVariants((prev) => [
			...prev,
			{
				...emptyVariantDraft(),
				uid,
				attributes: { ...defaults.attributes },
				attributeDisplay: defaults.attributeDisplay ?? {},
			},
		]);
		setSelectedVariantUid(uid);
		syncVariantWorkspaceUrl(uid);
	}

	function updateVariant(uid: string, next: VariantDraft) {
		const index = variants.findIndex((row) => row.uid === uid);
		setVariants((prev) => prev.map((variant) => (variant.uid === uid ? next : variant)));
		if (index >= 0) {
			const errorPrefix = `variants.${index}`;
			setErrors((prev) => prev.filter((row) => !row.path.startsWith(errorPrefix)));
		}
	}

	function removeVariant(uid: string) {
		const index = variants.findIndex((row) => row.uid === uid);
		const nextVariants = variants.filter((row) => row.uid !== uid);
		setVariants(nextVariants);
		if (selectedVariantUid === uid) {
			const neighbor = nextVariants[index] ?? nextVariants[index - 1] ?? null;
			const nextUid = neighbor?.uid ?? null;
			setSelectedVariantUid(nextUid);
			syncVariantWorkspaceUrl(nextUid);
		}
	}

	function selectVariantUid(uid: string) {
		setSelectedVariantUid(uid);
		syncVariantWorkspaceUrl(uid);
	}

	function handleSkip() {
		if (submitting) return;
		onSkip();
	}

	function handleClose() {
		if (submitting) return;
		onClose();
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!form.reportValidity()) return;
		if (submitting || !product || !surface) return;

		if (variants.length === 0) {
			toast.danger("Add at least one variant, or skip for now.");
			return;
		}

		const seen = new Set<string>();
		for (const variant of variants) {
			const key = combinationSignature(variant);
			if (seen.has(key)) {
				toast.danger("Two variants share the same attributes.");
				return;
			}
			seen.add(key);
		}

		const result = validateVariantDrafts(variants, surface, product.brand.slug, attributeConfig);

		if (!result.ok) {
			setErrors(result.errors);
			const nextErrorMap = errorsByPath(result.errors);
			const firstInvalidIndex = variants.findIndex((row, index) => variantHasErrors(nextErrorMap, `variants.${index}`));
			if (firstInvalidIndex >= 0) {
				const firstInvalid = variants[firstInvalidIndex];
				setSelectedVariantUid(firstInvalid.uid);
				syncVariantWorkspaceUrl(firstInvalid.uid);
			}
			toast.danger(
				firstInvalidIndex >= 0
					? "Fix the highlighted variant."
					: result.errors.length === 1
						? result.errors[0].message
						: `${result.errors.length} fields need attention.`,
			);
			return;
		}

		setErrors([]);
		setSubmitting(true);
		try {
			const keepVariantIds = new Set(variants.filter((row) => isValidId(row.uid)).map((row) => row.uid));
			for (const existing of product.variants) {
				if (keepVariantIds.has(existing.id)) continue;
				await apiFetch<AdminProduct>(`/api/products/${product.id}/variants/${existing.id}`, { method: "DELETE" });
			}

			for (let index = 0; index < result.payload.variants.length; index += 1) {
				const variant = result.payload.variants[index];
				const draftRow = variants[index];
				const uploadedImages = await uploadGalleryImages(draftRow.images, {
					subjectKind: "products/variants",
					subjectId: `${product.id}-${draftRow.uid}`,
				});
				const payload = { ...variant, images: uploadedImages };
				await (isValidId(draftRow.uid)
					? apiFetch<AdminProduct>(`/api/products/${product.id}/variants/${draftRow.uid}`, { method: "PUT", json: payload })
					: apiFetch<AdminProduct>(`/api/products/${product.id}/variants`, { method: "POST", json: payload }));
			}

			const latest = await apiFetch<AdminProduct>(`/api/products/${product.id}`);
			const savedCount = result.payload.variants.length;
			toast.success(savedCount === 1 ? "1 variation saved." : `${savedCount} variations saved.`);
			resetWorkspace(latest, selectedVariantUid);
			onSaved(latest);
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to save variations.";
			toast.danger(message);
		} finally {
			setSubmitting(false);
		}
	}

	const productScopedAttributes = useMemo(() => filterAttributesForProduct(attributes, attributeConfig), [attributes, attributeConfig]);

	if (!product) {
		return null;
	}

	return (
		<>
			<form id="product-wizard-step2" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
				{variants.length === 0 && product.variants.length === 0 ? (
					<div className="px-6 py-5">
						<p className="text-[13px] leading-relaxed text-[var(--color-ink-600)]">Add variants for this product — price, stock, and attribute combinations.</p>
						<div className="mt-4">
							<WizardEmptyHint>
								Product <strong>{product.name}</strong> is saved.
							</WizardEmptyHint>
						</div>
					</div>
				) : null}

				<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
					<aside className="flex w-[17.5rem] shrink-0 flex-col border-r border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 xl:w-80">
						<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Variants</p>
						<nav aria-label="Product variants" className="-mx-0.5 min-h-0 flex-1 overflow-y-auto">
							{variants.length === 0 ? (
								<p className="px-1 py-2 text-[11px] text-[var(--color-ink-500)]">No variants yet.</p>
							) : (
								<ul className="flex flex-col gap-2">
									{variants.map((variant, index) => {
										const errorPrefix = `variants.${index}`;
										return (
											<VariantSidebarTile
												key={variant.uid}
												variant={variant}
												attributes={productScopedAttributes}
												isSelected={variant.uid === selectedVariantUid}
												hasErrors={variantHasErrors(errorMap, errorPrefix)}
												errorCount={variantErrorCount(errorMap, errorPrefix)}
												onSelect={() => selectVariantUid(variant.uid)}
												onChange={(next) => updateVariant(variant.uid, next)}
											/>
										);
									})}
								</ul>
							)}
						</nav>
						<Button variant="outline" size="sm" type="button" className="mt-2 w-full border-dashed" leadingIcon={<Plus size={13} aria-hidden />} onClick={addVariant}>
							New variant
						</Button>
					</aside>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						{!selectedVariant ? (
							<div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
								<p className="text-sm font-semibold text-[var(--color-ink-800)]">No variant selected</p>
								<p className="mt-1 max-w-xs text-[12px] text-[var(--color-ink-500)]">Add a variant or pick one from the sidebar.</p>
								<Button variant="primary" size="sm" type="button" className="mt-4" leadingIcon={<Plus size={13} aria-hidden />} onClick={addVariant}>
									Add variant
								</Button>
							</div>
						) : (
							<>
								{selectedIndex >= 0 && variantHasErrors(errorMap, `variants.${selectedIndex}`) ? (
									<div className="border-b border-[var(--color-rose-200)] bg-[var(--color-rose-50)] px-3 py-2 text-[12px] font-medium text-[var(--color-rose-800)]">
										This variant has fields that need attention — check attributes, price, and stock below.
									</div>
								) : null}
								<div className="min-h-0 flex-1 overflow-y-auto p-3">
									<VariantCard
										index={selectedIndex}
										variant={selectedVariant}
										attributes={attributes}
										errorByPath={errorMap}
										productNameForAlt={product.name}
										errorPathPrefix={`variants.${selectedIndex}`}
										allowMultiAttributeSelect={false}
										productConfig={attributeConfig}
										embedded
										onChange={(next) => updateVariant(selectedVariant.uid, next)}
										onRemove={() => removeVariant(selectedVariant.uid)}
									/>
								</div>
								<VariantDetailFooter
									variant={selectedVariant}
									errorPathPrefix={`variants.${selectedIndex}`}
									errorByPath={errorMap}
									onChange={(next) => updateVariant(selectedVariant.uid, next)}
									onRemove={() => removeVariant(selectedVariant.uid)}
								/>
							</>
						)}
					</div>
				</div>
			</form>
			<div className="safe-bottom shrink-0 border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-4 py-3 md:px-5 md:py-4">
				<div className={standalone ? "flex flex-wrap items-center justify-end gap-2" : "flex flex-wrap items-center justify-between gap-2"}>
					{!standalone && stepLabel ? <div className="text-sm font-medium text-[var(--color-ink-500)]">{stepLabel}</div> : null}
					<div className="flex flex-wrap items-center justify-end gap-2">
						{!isManage && !onBack && !standalone ? (
							<Button variant="ghost" size="sm" type="button" onClick={handleSkip} disabled={submitting} className="mr-auto">
								Skip for now
							</Button>
						) : null}

						{onBack && !standalone ? (
							<Button variant="ghost" size="sm" type="button" onClick={onBack} disabled={submitting}>
								Back
							</Button>
						) : (
							<Button variant="ghost" size="sm" type="button" onClick={handleClose} disabled={submitting}>
								{standalone || isManage ? "Close" : "Cancel"}
							</Button>
						)}

						<Button variant="primary" size="sm" type="submit" form="product-wizard-step2" isLoading={submitting}>
							{standalone ? "Save" : (nextLabel ?? (isManage ? "Save changes" : "Save variations"))}
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
