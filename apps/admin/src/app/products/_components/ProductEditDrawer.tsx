"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { CatalogSeoPanel } from "@/app/settings/_components/CatalogSeoPanel";
import { uploadGalleryImages, type GalleryImage } from "@/components/shared/uploads/imageStaging";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import type { ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";
import type { SeoMeta } from "@store/shared";
import type { AdminProduct } from "@/types/models";

import { collectProductImageErrors } from "./productFormState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProductWizardStep2 } from "./ProductWizardStep2";
import { ProductDetailsForm, ProductDetailsFormSkeleton } from "./ProductDetailsForm";
import {
	attributeConfigForCategory,
	attributeConfigForEditor,
	analyzeAttributeConfigImpact,
	buildAttributeConfigForSave,
	countVariantsUsingAttribute,
	formatAttributeConfigImpactLines,
	hasAttributeConfigImpact,
	type AttributeConfigImpactSummary,
} from "./productAttributeConfigState";
import type { ProductAttributeConfig } from "@store/shared";
import type { AdminAttribute } from "@/types/models";

export type ProductEditStep = 1 | 2 | 3;

const STEP_TITLES: Record<ProductEditStep, string> = {
	1: "Edit details",
	2: "Edit variants",
	3: "Edit SEO",
};

interface ProductEditDrawerProps {
	productId: string | null;
	step: ProductEditStep;
	catalog: ProductWizardCatalog;
	isOpen: boolean;
	onClose: () => void;
	onSaved: () => void;
}

export function ProductEditDrawer({ productId, step, catalog, isOpen, onClose, onSaved }: ProductEditDrawerProps) {
	const router = useRouter();
	const toast = useToast();
	const [product, setProduct] = useState<AdminProduct | null>(null);
	const [loading, setLoading] = useState(false);
	const [name, setName] = useState("");
	const [categorySlug, setCategorySlug] = useState("");
	const [pendingCategorySlug, setPendingCategorySlug] = useState<string | null>(null);
	const [brandSlug, setBrandSlug] = useState("");
	const [pendingBrandSlug, setPendingBrandSlug] = useState<string | null>(null);
	const [seo, setSeo] = useState<SeoMeta>({});
	const [images, setImages] = useState<GalleryImage[]>([]);
	const [imagesError, setImagesError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [attributeConfig, setAttributeConfig] = useState<ProductAttributeConfig>({
		attributeSlugs: [],
		attributeOptionPool: {},
	});
	const [pendingAttributeSaveImpact, setPendingAttributeSaveImpact] = useState<AttributeConfigImpactSummary | null>(null);
	const [pendingAttributeDisable, setPendingAttributeDisable] = useState<{
		attribute: AdminAttribute;
		variantCount: number;
		proceed: () => void;
	} | null>(null);

	const skipAttributeSaveConfirmRef = useRef(false);
	const attributeConfigRef = useRef(attributeConfig);
	const catalogRef = useRef(catalog);
	const toastRef = useRef(toast);
	const onCloseRef = useRef(onClose);
	const loadedProductIdRef = useRef<string | null>(null);

	const categoryAttributes = categorySlug ? (catalog.attributesByCategory[categorySlug] ?? []) : [];
	const categoryAttributesRef = useRef(categoryAttributes);

	useEffect(() => {
		attributeConfigRef.current = attributeConfig;
		catalogRef.current = catalog;
		toastRef.current = toast;
		onCloseRef.current = onClose;
		categoryAttributesRef.current = categoryAttributes;
	});

	const category = useMemo(() => (categorySlug ? (catalog.categories.find((row) => row.slug === categorySlug) ?? null) : null), [catalog.categories, categorySlug]);

	const brands = categorySlug ? (catalog.brandsByCategory[categorySlug] ?? []) : [];

	useEffect(() => {
		if (!isOpen || !productId) {
			loadedProductIdRef.current = null;
			return;
		}
		if (loadedProductIdRef.current === productId) {
			return;
		}

		let cancelled = false;
		scheduleStateUpdate(() => {
			setLoading(true);
		});
		apiFetch<AdminProduct>(`/api/products/${productId}`)
			.then((loaded) => {
				if (cancelled) return;
				loadedProductIdRef.current = productId;
				setProduct(loaded);
				setName(loaded.name);
				setCategorySlug(loaded.categorySlug);
				setBrandSlug(loaded.brand.slug);
				setSeo(loaded.seo ?? {});
				setImages((loaded.images ?? []) as GalleryImage[]);
				setImagesError(null);
				const attrs = catalogRef.current.attributesByCategory[loaded.categorySlug] ?? [];
				setAttributeConfig(attributeConfigForEditor(loaded, attrs));
			})
			.catch((error) => {
				if (cancelled) return;
				toastRef.current.danger(error instanceof ApiError ? error.message : "Failed to load product.");
				onCloseRef.current();
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, productId]);

	async function performStep1Save() {
		if (!product || saving) return;

		setSaving(true);
		try {
			const trimmed = name.trim();
			if (trimmed.length < 2) {
				toast.danger("Product name is required.");
				return;
			}
			const imageProblems = collectProductImageErrors(images);
			if (imageProblems.length > 0) {
				const message = imageProblems[0].message;
				setImagesError(message);
				toast.danger(message);
				return;
			}
			setImagesError(null);

			const attributePayload = buildAttributeConfigForSave(attributeConfigRef.current, categoryAttributesRef.current);

			const uploaded = await uploadGalleryImages(images, {
				subjectKind: "products",
				subjectId: product.id,
			});

			const saved = await apiFetch<AdminProduct>(`/api/products/${product.id}`, {
				method: "PUT",
				json: {
					name: trimmed,
					categorySlug,
					brandSlug,
					...attributePayload,
				},
			});

			const attrs = categoryAttributesRef.current;
			const nextConfig = attributeConfigForEditor(saved, attrs);
			attributeConfigRef.current = nextConfig;
			setAttributeConfig(nextConfig);
			setProduct(saved);

			await apiFetch<AdminProduct>(`/api/products/${product.id}/images`, {
				method: "PUT",
				json: { images: uploaded },
			});
			loadedProductIdRef.current = null;
			toast.success("Product updated.");
			router.refresh();
			onSaved();
			onClose();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to save product.");
		} finally {
			setSaving(false);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!form.reportValidity()) return;
		if (!product || saving) return;

		if (step === 1) {
			if (!skipAttributeSaveConfirmRef.current) {
				const impact = analyzeAttributeConfigImpact(attributeConfig, product.variants, categoryAttributes);
				if (hasAttributeConfigImpact(impact)) {
					setPendingAttributeSaveImpact(impact);
					return;
				}
			}
			skipAttributeSaveConfirmRef.current = false;
			await performStep1Save();
			return;
		}

		setSaving(true);
		try {
			await apiFetch<AdminProduct>(`/api/products/${product.id}`, {
				method: "PUT",
				json: { seo },
			});
			toast.success("Product updated.");
			router.refresh();
			onSaved();
			onClose();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to save product.");
		} finally {
			setSaving(false);
		}
	}

	const shellFooter =
		step === 1 || step === 3 ? (
			<div className="flex items-center justify-end gap-2">
				<Button variant="ghost" size="md" type="button" onClick={onClose} disabled={saving}>
					Close
				</Button>
				<Button variant="primary" size="md" type="submit" form="product-edit-drawer" isLoading={saving} disabled={loading || !product}>
					Save
				</Button>
			</div>
		) : undefined;

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title={STEP_TITLES[step]}
			description={product?.name ?? (loading ? "Loading…" : undefined)}
			width="2xl"
			bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
			footer={shellFooter}
		>
			{loading ? (
				<ProductDetailsFormSkeleton />
			) : product ? (
				<>
					{(step === 1 || step === 3) && (
						<form id="product-edit-drawer" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
							{step === 1 ? (
								<ProductDetailsForm
									name={name}
									onNameChange={setName}
									categories={catalog.categories}
									categorySlug={categorySlug}
									onCategorySelect={(slug) => {
										if (categorySlug === slug) return;
										if (categorySlug && product.categorySlug === categorySlug) {
											setPendingCategorySlug(slug);
											return;
										}
										setCategorySlug(slug);
										if (!catalog.brandsByCategory[slug]?.some((brandItem) => brandItem.slug === brandSlug)) {
											setBrandSlug("");
										}
									}}
									brands={brands}
									brandSlug={brandSlug}
									onBrandSelect={(slug) => {
										if (brandSlug === slug) return;
										if (brandSlug && product.brand.slug === brandSlug) {
											setPendingBrandSlug(slug);
											return;
										}
										setBrandSlug(slug);
									}}
									showBrandPicker={Boolean(categorySlug)}
									images={images}
									onImagesChange={(next) => {
										setImages(next);
										setImagesError(null);
									}}
									imagesAltBase={name || product.name}
									imagesError={imagesError}
									showPhotos={Boolean(categorySlug)}
									categoryAttributes={categoryAttributes}
									attributeConfig={attributeConfig}
									onAttributeConfigChange={setAttributeConfig}
									onConfirmDisableAttribute={(attribute, proceed) => {
										const variantCount = countVariantsUsingAttribute(product.variants, attribute.slug);
										if (variantCount === 0) {
											proceed();
											return;
										}
										setPendingAttributeDisable({ attribute, variantCount, proceed });
									}}
									showAttributes={Boolean(categorySlug)}
								/>
							) : (
								<div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
									<CatalogSeoPanel
										value={seo}
										onChange={setSeo}
										contextLabel={`Product · ${product.brand.name} ${name}`}
										entity={{
											type: "product",
											entity: {
												slug: product.slug,
												name,
												brandName: product.brand.name,
												categorySlug: product.categorySlug,
												brand: { slug: product.brand.slug, name: product.brand.name },
												category: category
													? {
															slug: category.slug,
															label: category.label,
															description: category.description,
														}
													: undefined,
												images: product.images,
												variants: product.variants.map((variantItem) => ({
													id: variantItem.id,
												})),
											},
										}}
									/>
								</div>
							)}
						</form>
					)}

					{step === 2 && (
						<ProductWizardStep2
							product={product}
							catalog={catalog}
							onClose={onClose}
							onSkip={onClose}
							onSaved={(latest) => {
								if (latest) {
									setProduct(latest);
								}
								router.refresh();
								onSaved();
								onClose();
							}}
							purpose="manage"
							standalone
						/>
					)}
				</>
			) : null}

			<ConfirmDialog
				isOpen={pendingCategorySlug !== null}
				title="Change Category"
				message="Changing the category will reset the product's variants and might unselect the brand if it does not belong to the new category. Are you sure you want to proceed?"
				confirmLabel="Change category"
				tone="danger"
				onConfirm={() => {
					if (pendingCategorySlug) {
						setCategorySlug(pendingCategorySlug);
						const attrs = catalog.attributesByCategory[pendingCategorySlug] ?? [];
						setAttributeConfig(attributeConfigForCategory(attrs));
						if (!catalog.brandsByCategory[pendingCategorySlug]?.some((b) => b.slug === brandSlug)) {
							setBrandSlug("");
						}
					}
					setPendingCategorySlug(null);
				}}
				onCancel={() => setPendingCategorySlug(null)}
			/>

			<ConfirmDialog
				isOpen={pendingBrandSlug !== null}
				title="Change Brand"
				message="Are you sure you want to change the brand of this product?"
				confirmLabel="Change brand"
				tone="danger"
				onConfirm={() => {
					if (pendingBrandSlug) {
						setBrandSlug(pendingBrandSlug);
					}
					setPendingBrandSlug(null);
				}}
				onCancel={() => setPendingBrandSlug(null)}
			/>

			<ConfirmDialog
				isOpen={pendingAttributeDisable !== null}
				title="Disable attribute"
				message={
					pendingAttributeDisable ? (
						<div className="space-y-2 text-[13px] leading-snug text-[var(--color-ink-700)]">
							<p>
								{pendingAttributeDisable.variantCount} variant
								{pendingAttributeDisable.variantCount === 1 ? "" : "s"} currently use <strong>{pendingAttributeDisable.attribute.label}</strong>. Disabling it will leave those
								values on existing variants, but they will no longer match this product&apos;s allowed attributes.
							</p>
						</div>
					) : null
				}
				confirmLabel="Disable attribute"
				tone="danger"
				onConfirm={() => {
					pendingAttributeDisable?.proceed();
					setPendingAttributeDisable(null);
				}}
				onCancel={() => setPendingAttributeDisable(null)}
			/>

			<ConfirmDialog
				isOpen={pendingAttributeSaveImpact !== null}
				title="Save attribute changes"
				message={
					pendingAttributeSaveImpact ? (
						<div className="space-y-2 text-[13px] leading-snug text-[var(--color-ink-700)]">
							<p>Saving will change which attributes and options variants can use. Existing variants may keep values that no longer match:</p>
							<ul className="list-disc space-y-1 pl-4">
								{formatAttributeConfigImpactLines(pendingAttributeSaveImpact).map((line) => (
									<li key={line}>{line}</li>
								))}
							</ul>
						</div>
					) : null
				}
				confirmLabel="Save anyway"
				tone="danger"
				onConfirm={() => {
					setPendingAttributeSaveImpact(null);
					skipAttributeSaveConfirmRef.current = true;
					void performStep1Save();
				}}
				onCancel={() => setPendingAttributeSaveImpact(null)}
			/>
		</Drawer>
	);
}
