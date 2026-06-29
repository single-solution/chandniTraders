"use client";

import Link from "next/link";

import { ImageGallery } from "@/components/shared/uploads";
import type { GalleryImage } from "@/components/shared/uploads/imageStaging";
import type { Dispatch, SetStateAction } from "react";
import type { ProductAttributeConfig } from "@store/shared";
import type { AdminAttribute, AdminBrand, AdminCategory } from "@/types/models";

import { ProductAttributeSetup } from "./ProductAttributeSetup";
import { CategoriesEmptyHint, CategoryOptionButton, WizardEmptyHint, WizardFieldError, WizardSection } from "./productWizardUi";

interface ProductDetailsFormProps {
	name: string;
	onNameChange: (value: string) => void;
	nameDisabled?: boolean;
	slugHint?: string;

	categories: AdminCategory[];
	categorySlug: string;
	onCategorySelect: (slug: string) => void;

	brands: AdminBrand[];
	brandSlug: string;
	onBrandSelect: (slug: string) => void;
	showBrandPicker: boolean;

	images: GalleryImage[];
	onImagesChange: (images: GalleryImage[]) => void;
	imagesAltBase: string;
	imagesError?: string | null;
	showPhotos: boolean;

	categoryAttributes: AdminAttribute[];
	attributeConfig: ProductAttributeConfig;
	onAttributeConfigChange: Dispatch<SetStateAction<ProductAttributeConfig>>;
	onConfirmDisableAttribute?: (attribute: AdminAttribute, proceed: () => void) => void;
	showAttributes: boolean;

	errorMap?: Map<string, string>;
}

export function ProductDetailsForm({
	name,
	onNameChange,
	nameDisabled = false,
	slugHint,
	categories,
	categorySlug,
	onCategorySelect,
	brands,
	brandSlug,
	onBrandSelect,
	showBrandPicker,
	images,
	onImagesChange,
	imagesAltBase,
	imagesError,
	showPhotos,
	categoryAttributes,
	attributeConfig,
	onAttributeConfigChange,
	onConfirmDisableAttribute,
	showAttributes,
	errorMap,
}: ProductDetailsFormProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
					<WizardSection title="Name">
						<input
							type="text"
							required
							value={name}
							onChange={(event) => onNameChange(event.target.value)}
							maxLength={120}
							placeholder="Product name"
							disabled={nameDisabled}
							autoComplete="off"
							className="block w-full rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[15px] focus:border-[var(--color-accent-500)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						/>
						{slugHint && categorySlug ? (
							<p className="mt-1 text-[11.5px] text-[var(--color-ink-500)]">
								Storefront URL:{" "}
								<code>
									/{categorySlug}/{slugHint}
								</code>
							</p>
						) : null}
						<WizardFieldError message={errorMap?.get("name")} />
					</WizardSection>

					<WizardSection title="Category">
						{categories.length === 0 ? (
							<CategoriesEmptyHint />
						) : (
							<div className="flex flex-wrap gap-1.5">
								{categories.map((category) => (
									<CategoryOptionButton key={category.id} category={category} isSelected={categorySlug === category.slug} onSelect={() => onCategorySelect(category.slug)} />
								))}
							</div>
						)}
						<WizardFieldError message={errorMap?.get("categorySlug")} />
					</WizardSection>

					<WizardSection title="Brand">
						{!showBrandPicker ? (
							<WizardEmptyHint>Select a category first to see available brands.</WizardEmptyHint>
						) : brands.length === 0 ? (
							<WizardEmptyHint>
								This category has no brands yet. Add one from{" "}
								<Link href="/categories" className="font-semibold text-[var(--color-accent-700)] underline">
									Categories
								</Link>
								.
							</WizardEmptyHint>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{brands.map((brand) => (
									<button
										key={brand.id}
										type="button"
										onClick={() => onBrandSelect(brand.slug)}
										className={
											"rounded-full border px-2.5 py-1 text-[13px] font-semibold transition " +
											(brandSlug === brand.slug
												? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
												: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)]")
										}
									>
										{brand.name}
									</button>
								))}
							</div>
						)}
						<WizardFieldError message={errorMap?.get("brandSlug")} />
					</WizardSection>

					<WizardSection title="Photos">
						{!showPhotos ? (
							<WizardEmptyHint>Select a category first.</WizardEmptyHint>
						) : (
							<>
								<p className="mb-2 text-[11.5px] text-[var(--color-ink-500)]">One gallery for the whole product — shared by every variant.</p>
								<ImageGallery value={images} onChange={onImagesChange} altTextBase={imagesAltBase} maxImages={8} compact dense />
							</>
						)}
						<WizardFieldError message={imagesError ?? errorMap?.get("images")} />
					</WizardSection>
				</div>
			</div>

			<aside className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] lg:w-[21rem] lg:flex-none lg:border-t-0 lg:border-l xl:w-[24rem]">
				<div className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
					{!showAttributes ? (
						<WizardEmptyHint>Select a category first.</WizardEmptyHint>
					) : categoryAttributes.length === 0 ? (
						<WizardEmptyHint>This category has no attributes yet.</WizardEmptyHint>
					) : (
						<ProductAttributeSetup
							attributes={categoryAttributes}
							config={attributeConfig}
							onChange={onAttributeConfigChange}
							onConfirmDisableAttribute={onConfirmDisableAttribute}
							errorByPath={errorMap}
							compact
						/>
					)}
				</div>
			</aside>
		</div>
	);
}

export function ProductDetailsFormSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 animate-pulse flex-col overflow-hidden lg:flex-row">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
						<div className="mb-3 h-3 w-12 rounded bg-[var(--color-ink-200)]" />
						<div className="h-10 w-full rounded-md bg-[var(--color-ink-100)]" />
					</div>
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<div className="mb-3 h-3 w-20 rounded bg-[var(--color-ink-200)]" />
						<div className="flex flex-wrap gap-1.5">
							<div className="h-7 w-16 rounded-full bg-[var(--color-ink-100)]" />
							<div className="h-7 w-20 rounded-full bg-[var(--color-ink-100)]" />
						</div>
					</div>
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<div className="mb-3 h-3 w-14 rounded bg-[var(--color-ink-200)]" />
						<div className="flex flex-wrap gap-1.5">
							<div className="h-7 w-16 rounded-full bg-[var(--color-ink-100)]" />
							<div className="h-7 w-14 rounded-full bg-[var(--color-ink-100)]" />
						</div>
					</div>
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<div className="mb-3 h-3 w-14 rounded bg-[var(--color-ink-200)]" />
						<div className="flex gap-2">
							<div className="size-20 rounded-md bg-[var(--color-ink-100)]" />
							<div className="size-20 rounded-md border border-dashed border-[var(--color-ink-200)]" />
						</div>
					</div>
				</div>
			</div>
			<aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-[var(--color-ink-100)] lg:w-[21rem] lg:border-t-0 lg:border-l xl:w-[24rem]">
				<div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<div className="mb-3 h-3 w-20 rounded bg-[var(--color-ink-200)]" />
						<div className="h-24 w-full rounded-md bg-[var(--color-ink-100)]" />
					</div>
				</div>
			</aside>
		</div>
	);
}
