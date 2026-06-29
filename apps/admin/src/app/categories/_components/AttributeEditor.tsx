"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
	ATTRIBUTE_VISIBILITY_ALWAYS,
	compareAlphabetically,
	compactAttributeOptionValue,
	formatAttributeOptionLabel,
	type AttributeVisibility,
	type AttributeVisibilityType,
} from "@store/shared";

import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { ATTRIBUTE_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import type { AdminAttribute, AdminAttributeCardPosition, AdminAttributeOption, AdminBrand, AdminCategory } from "@/types/models";

import { PreviewPanel } from "./previewPanel";
import { AttributeCardChipPreview, AttributeFilterGroupPreview, AttributeSpecStripPreview, type AttributeDraft } from "./previews";

interface AttributeEditorProps {
	isOpen: boolean;
	onClose: () => void;
	attribute: AdminAttribute | null;
	category: AdminCategory;
	brands: AdminBrand[];
	onSaved: () => void;
}

const CARD_POSITIONS: { value: AdminAttributeCardPosition; label: string }[] = [
	{ value: "image-overlay", label: "Image overlay" },
	{ value: "title-chips", label: "Title chip" },
];

interface OptionFormRow {
	label: string;
}

interface FormState {
	label: string;
	unit: string;
	cardPosition: AdminAttributeCardPosition;
	visibilityType: AttributeVisibilityType;
	brandSlugs: string[];
	options: OptionFormRow[];
}

function emptyForm(): FormState {
	return {
		label: "",
		unit: "",
		cardPosition: "title-chips",
		visibilityType: "always",
		brandSlugs: [],
		options: [{ label: "" }],
	};
}

function visibilityFromAttribute(visibility: AttributeVisibility | undefined): Pick<FormState, "visibilityType" | "brandSlugs"> {
	const rule = visibility ?? ATTRIBUTE_VISIBILITY_ALWAYS;
	if (rule.type === "brand") {
		return {
			visibilityType: "brand",
			brandSlugs: rule.brandSlugs ?? [],
		};
	}
	return {
		visibilityType: "always",
		brandSlugs: [],
	};
}

function buildVisibilityPayload(form: FormState): AttributeVisibility {
	if (form.visibilityType === "brand") {
		return { type: "brand", brandSlugs: form.brandSlugs };
	}
	return ATTRIBUTE_VISIBILITY_ALWAYS;
}

function optionFromStored(option: AdminAttributeOption): OptionFormRow {
	return {
		label: option.label,
	};
}

function sortOptionRows(rows: OptionFormRow[]): OptionFormRow[] {
	return [...rows].sort((left, right) => compareAlphabetically(left.label, right.label));
}

function formFromAttribute(attribute: AdminAttribute): FormState {
	return {
		label: attribute.label,
		unit: attribute.unit ?? "",
		cardPosition: attribute.cardPosition,
		...visibilityFromAttribute(attribute.visibility),
		options: attribute.options.length > 0 ? sortOptionRows(attribute.options.map(optionFromStored)) : [{ label: "" }],
	};
}

function previewOptionsFromRows(rows: OptionFormRow[], unit: string): AdminAttributeOption[] {
	const unitTrimmed = unit.trim();
	return rows
		.filter((row) => row.label.trim().length > 0)
		.map((row) => {
			const label = row.label.trim();
			const value = compactAttributeOptionValue(label, unitTrimmed);
			return {
				value: value || "preview",
				label,
			};
		});
}

export function AttributeEditor({ isOpen, onClose, attribute, category, brands, onSaved }: AttributeEditorProps) {
	const toast = useToast();
	const [form, setForm] = useState<FormState>(() => (attribute ? formFromAttribute(attribute) : emptyForm()));
	const [submitting, setSubmitting] = useState(false);

	const deferredForm = useDeferredValue(form);
	const draft: AttributeDraft = useMemo(
		() => ({
			label: deferredForm.label,
			unit: deferredForm.unit,
			cardPosition: deferredForm.cardPosition,
			options: previewOptionsFromRows(deferredForm.options, deferredForm.unit),
		}),
		[deferredForm],
	);

	useEffect(() => {
		if (!isOpen) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form on drawer open; the drawer is the external system here
		setForm(attribute ? formFromAttribute(attribute) : emptyForm());
	}, [isOpen, attribute]);

	function updateOption(index: number, patch: Partial<OptionFormRow>) {
		setForm((prev) => {
			const next = prev.options.slice();
			next[index] = { ...next[index], ...patch };
			return { ...prev, options: next };
		});
	}
	function addOption() {
		setForm((prev) => {
			if (prev.options.length >= ATTRIBUTE_FIELD_LIMITS.optionCount) return prev;
			return {
				...prev,
				options: [...prev.options, { label: "" }],
			};
		});
	}
	function removeOption(index: number) {
		setForm((prev) => {
			if (prev.options.length === 1) return prev;
			return {
				...prev,
				options: prev.options.filter((_, i) => i !== index),
			};
		});
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (submitting) return;
		if (!form.label.trim()) {
			toast.danger("Label is required.");
			return;
		}
		const cleanedOptions = form.options
			.map((opt) => ({
				label: opt.label.trim(),
			}))
			.filter((opt) => opt.label.length > 0);
		if (cleanedOptions.length === 0) {
			toast.danger("Add at least one option.");
			return;
		}
		setSubmitting(true);
		try {
			const payload = {
				label: form.label.trim(),
				unit: form.unit.trim(),
				options: cleanedOptions,
				cardPosition: form.cardPosition,
				visibility: buildVisibilityPayload(form),
			};
			if (attribute) {
				await apiFetch<AdminAttribute>(`/api/attributes/${attribute.id}`, {
					method: "PUT",
					json: payload,
				});
				toast.success("Attribute updated.");
			} else {
				await apiFetch<AdminAttribute>("/api/attributes", {
					method: "POST",
					json: {
						categorySlug: category.slug,
						...payload,
					},
				});
				toast.success("Attribute created.");
			}
			onSaved();
			onClose();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to save attribute.";
			toast.danger(message);
		} finally {
			setSubmitting(false);
		}
	}

	const previewTiles = useMemo(() => {
		const tiles: { surfaceLabel: string; body: React.ReactNode }[] = [
			{
				surfaceLabel: "Storefront · PDP spec strip",
				body: <AttributeSpecStripPreview attribute={draft} />,
			},
			{
				surfaceLabel: "Storefront · Shop filter sidebar",
				body: <AttributeFilterGroupPreview attribute={draft} />,
			},
		];
		tiles.push({
			surfaceLabel: draft.cardPosition === "image-overlay" ? "Storefront · Product card (image overlay)" : "Storefront · Product card (title chip)",
			body: <AttributeCardChipPreview attribute={draft} />,
		});
		return tiles;
	}, [draft]);

	const attributeUnit = form.unit.trim();

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title={attribute ? `Edit · ${attribute.label}` : `New attribute · ${category.label}`}
			description="Global options are templates for variants and filters. Shop filters only show values that exist on products in the current listing. Product-only values (e.g. a one-off color) are added on each variant, not here."
			width="xl"
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button variant="primary" size="sm" type="submit" form="attribute-editor-form" isLoading={submitting}>
						{attribute ? "Save changes" : "Create attribute"}
					</Button>
				</div>
			}
		>
			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
				<form id="attribute-editor-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div>
						<label htmlFor="attribute-label" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
							Attribute label
						</label>
						<input
							id="attribute-label"
							type="text"
							value={form.label}
							onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
							placeholder="e.g. Storage"
							maxLength={ATTRIBUTE_FIELD_LIMITS.label}
							required
							className="block w-full rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[14px] focus:border-[var(--color-accent-500)] focus:outline-none"
						/>
						<p className="mt-1 text-[11.5px] text-[var(--color-ink-500)]">Slug is generated from this label when you save (used in variant data and filter URLs).</p>
					</div>
					<div>
						<label htmlFor="attribute-unit" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
							Unit
						</label>
						<input
							id="attribute-unit"
							type="text"
							value={form.unit}
							onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
							placeholder="e.g. gb (optional)"
							maxLength={ATTRIBUTE_FIELD_LIMITS.unit}
							className="block w-full max-w-xs rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[14px] focus:border-[var(--color-accent-500)] focus:outline-none"
						/>
						<p className="mt-1 text-[11.5px] text-[var(--color-ink-500)]">Shared by all options. Leave empty for unitless attributes (e.g. Color).</p>
					</div>
					<fieldset className="rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
						<legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Show when</legend>
						<p className="mb-2 text-[11.5px] text-[var(--color-ink-500)]">
							Controls when this attribute appears in shop filters. Per-product variant attributes are configured on each product&apos;s details page.
						</p>
						<div className="flex flex-wrap gap-2">
							{(
								[
									["always", "Always"],
									["brand", "Brand"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									onClick={() => setForm((prev) => ({ ...prev, visibilityType: value }))}
									className={
										"rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold transition " +
										(form.visibilityType === value
											? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
											: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)]")
									}
								>
									{label}
								</button>
							))}
						</div>
						{form.visibilityType === "brand" && (
							<div className="mt-2 flex flex-wrap gap-1.5">
								{brands.map((brand) => {
									const selected = form.brandSlugs.includes(brand.slug);
									return (
										<button
											key={brand.id}
											type="button"
											onClick={() =>
												setForm((prev) => ({
													...prev,
													brandSlugs: selected ? prev.brandSlugs.filter((slug) => slug !== brand.slug) : [...prev.brandSlugs, brand.slug],
												}))
											}
											className={
												"rounded-full border px-2.5 py-1 text-[12px] font-medium " +
												(selected
													? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
													: "border-[var(--color-ink-200)] text-[var(--color-ink-700)]")
											}
										>
											{brand.name}
										</button>
									);
								})}
							</div>
						)}
					</fieldset>
					<div>
						<span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">Product card placement</span>
						<div className="flex flex-wrap gap-2">
							{CARD_POSITIONS.map((position) => (
								<button
									key={position.value}
									type="button"
									onClick={() => setForm((prev) => ({ ...prev, cardPosition: position.value }))}
									className={
										"rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold transition " +
										(form.cardPosition === position.value
											? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
											: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)]")
									}
								>
									{position.label}
								</button>
							))}
						</div>
					</div>
					<fieldset className="rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
						<legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Options</legend>
						<p className="mb-2 text-[11.5px] text-[var(--color-ink-500)]">
							Each row is one value (e.g. 128, 256). Options are saved in alphabetical order. Slugs combine label + unit{attributeUnit ? ` (${attributeUnit})` : ""}.
						</p>
						<ul className="space-y-2">
							{form.options.map((option, index) => {
								const slugPreview = compactAttributeOptionValue(option.label, attributeUnit);
								return (
									<li key={index} className="rounded-md border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-2 py-2">
										<div className="flex items-center gap-2">
											<input
												type="text"
												value={option.label}
												onChange={(e) => updateOption(index, { label: e.target.value })}
												placeholder="Value (e.g. 256)"
												maxLength={ATTRIBUTE_FIELD_LIMITS.optionLabel}
												className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-[13px] focus:border-[var(--color-accent-500)] focus:bg-[var(--color-surface)] focus:outline-none"
											/>
											<button
												type="button"
												onClick={() => removeOption(index)}
												aria-label="Remove option"
												className="rounded p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-rose-100)] hover:text-[var(--color-rose-700)]"
											>
												<X size={14} />
											</button>
										</div>
										{Boolean(slugPreview) && (
											<p className="mt-1 text-[10.5px] text-[var(--color-ink-500)]">
												Slug <code className="rounded bg-[var(--color-surface)] px-1 py-0.5 font-mono text-[10px] text-[var(--color-ink-700)]">{slugPreview}</code>
												{Boolean(attributeUnit) && (
													<>
														{" "}
														· displays as <span className="text-[var(--color-ink-700)]">{formatAttributeOptionLabel(option.label, attributeUnit)}</span>
													</>
												)}
											</p>
										)}
									</li>
								);
							})}
						</ul>
						<button
							type="button"
							onClick={addOption}
							disabled={form.options.length >= ATTRIBUTE_FIELD_LIMITS.optionCount}
							className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)] disabled:opacity-60"
						>
							<Plus size={12} /> Add option
						</button>
					</fieldset>
				</form>
				<PreviewPanel tiles={previewTiles} />
			</div>
		</Drawer>
	);
}
