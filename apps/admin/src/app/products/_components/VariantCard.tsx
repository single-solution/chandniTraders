"use client";

import { useMemo } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { classNames, formatWarrantyPeriod, filterAttributesForProduct, mergeProductPoolIntoAttributeOptions, type ProductAttributeConfig } from "@store/shared";
import { compareAlphabetically, formatAttributeOptionLabel, sortAttributeOptions } from "@store/shared";

import type { AdminAttribute } from "@/types/models";

import { AttributeOptionTabRow, ATTRIBUTE_DIMENSION_LABEL_CLASS } from "./attributeOptionTabRow";
import { attributeValuesOnDraft, type VariantDraft } from "./productFormState";
import { ImageGallery } from "@/components/shared/uploads";

interface VariantCardProps {
	index: number;
	variant: VariantDraft;
	attributes: AdminAttribute[];
	errorByPath: Map<string, string>;
	productNameForAlt?: string;
	onChange: (next: VariantDraft) => void;
	onRemove: () => void;
	errorPathPrefix?: string;
	/** Lets admins pick multiple global options per attribute (wizard combinations). */
	allowMultiAttributeSelect?: boolean;
	/** Product attribute subset + option pools. */
	productConfig: ProductAttributeConfig;
	/** Flat layout inside a master–detail pane (no card chrome). */
	embedded?: boolean;
}

export function VariantCard({
	index,
	variant,
	attributes,
	errorByPath,
	onChange,
	onRemove,
	errorPathPrefix,
	allowMultiAttributeSelect = false,
	productConfig,
	productNameForAlt,
	embedded = false,
}: VariantCardProps) {
	const prefix = errorPathPrefix ?? `variants.${index}`;
	function fieldError(field: string) {
		return errorByPath.get(`${prefix}.${field}`);
	}
	function attrError(slug: string) {
		return errorByPath.get(`${prefix}.attributes.${slug}`);
	}

	const productAttributes = useMemo(() => filterAttributesForProduct(attributes, productConfig), [attributes, productConfig]);

	const scopedAttributes = useMemo(
		() =>
			[...productAttributes]
				.sort((left, right) => compareAlphabetically(left.label, right.label))
				.map((attribute) => ({
					...attribute,
					options: mergeProductPoolIntoAttributeOptions(attribute, productConfig),
				})),
		[productAttributes, productConfig],
	);

	return (
		<article
			className={
				embedded
					? "flex flex-col gap-3"
					: "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]"
			}
		>
			{!embedded && (
				<header className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<GripVertical size={14} className="text-[var(--color-ink-400)]" aria-hidden />
						<p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">Variant {index + 1}</p>
					</div>
					<button
						type="button"
						onClick={onRemove}
						aria-label="Remove variant"
						className="rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-1.5 text-[var(--color-ink-500)] transition hover:border-[var(--color-rose-300)] hover:bg-[var(--color-rose-100)] hover:text-[var(--color-rose-700)]"
					>
						<Trash2 size={14} />
					</button>
				</header>
			)}

			<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
				<div className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/55 px-2.5 py-2">
					<p className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)]">Photos</p>
					<p className="mt-0.5 text-[11px] text-[var(--color-ink-500)]">Shown on the storefront for this variant. Leave empty to use the product gallery.</p>
				</div>
				<div className="p-2.5">
					<ImageGallery
						value={variant.images}
						onChange={(images) => onChange({ ...variant, images })}
						altTextBase={productNameForAlt ? `${productNameForAlt} variant` : "Product variant"}
						maxImages={8}
						compact
						dense
					/>
					{fieldError("images") ? <p className="mt-1.5 text-[11px] text-[var(--color-rose-700)]">{fieldError("images")}</p> : null}
				</div>
			</div>

			{scopedAttributes.length > 0 && (
				<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
					<div className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/55 px-2.5 py-2">
						<p className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)]">Attributes</p>
						<p className="mt-0.5 text-[11px] text-[var(--color-ink-500)]">
							{allowMultiAttributeSelect ? "Select every value this variant covers (e.g. White and Black on one SKU)." : "Pick one option per attribute."}
						</p>
					</div>
					<div className="divide-y divide-[var(--color-ink-100)]">
						{scopedAttributes.map((attr) => (
							<AttributeValuePicker
								key={attr.id}
								attribute={attr}
								variant={variant}
								error={attrError(attr.slug)}
								onChange={onChange}
								allowMultiSelect={allowMultiAttributeSelect}
							/>
						))}
					</div>
				</div>
			)}

			{!embedded && (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<NumberField
						label="Price (Rs)"
						value={variant.priceRupees}
						min={0}
						onChange={(value) => onChange({ ...variant, priceRupees: value })}
						error={fieldError("priceRupees")}
					/>
					<NumberField label="Quantity" value={variant.quantity} min={0} onChange={(value) => onChange({ ...variant, quantity: value })} error={fieldError("quantity")} />
					<WarrantyDaysField value={variant.warrantyDays} onChange={(value) => onChange({ ...variant, warrantyDays: value })} error={fieldError("warrantyDays")} />
				</div>
			)}
		</article>
	);
}

interface VariantDetailFooterProps {
	variant: VariantDraft;
	errorPathPrefix: string;
	errorByPath: Map<string, string>;
	onChange: (next: VariantDraft) => void;
	onRemove: () => void;
}

export function VariantDetailFooter({ variant, errorPathPrefix, errorByPath, onChange, onRemove }: VariantDetailFooterProps) {
	function fieldError(field: string) {
		return errorByPath.get(`${errorPathPrefix}.${field}`);
	}

	return (
		<footer className="shrink-0 border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2.5">
			<div className="flex flex-wrap items-end gap-2 sm:gap-3">
				<NumberField
					label="Price (Rs)"
					value={variant.priceRupees}
					min={0}
					compact
					onChange={(value) => onChange({ ...variant, priceRupees: value })}
					error={fieldError("priceRupees")}
				/>
				<NumberField label="Quantity" value={variant.quantity} min={0} compact onChange={(value) => onChange({ ...variant, quantity: value })} error={fieldError("quantity")} />
				<WarrantyDaysField value={variant.warrantyDays} compact onChange={(value) => onChange({ ...variant, warrantyDays: value })} error={fieldError("warrantyDays")} />
				<button
					type="button"
					onClick={onRemove}
					className="ml-auto inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-rose-200)] px-2.5 text-[11px] font-semibold text-[var(--color-rose-700)] hover:bg-[var(--color-rose-50)]"
				>
					<Trash2 size={13} aria-hidden />
					Remove
				</button>
			</div>
		</footer>
	);
}

function AttributeValuePicker({
	attribute,
	variant,
	error,
	onChange,
	allowMultiSelect = false,
}: {
	attribute: AdminAttribute;
	variant: VariantDraft;
	error?: string;
	onChange: (next: VariantDraft) => void;
	allowMultiSelect?: boolean;
}) {
	const selectedValues = attributeValuesOnDraft(variant, attribute.slug);
	const hasMulti = allowMultiSelect && selectedValues.length > 0;
	const selectedValue = hasMulti ? undefined : variant.attributes[attribute.slug];

	function toggleMultiValue(value: string) {
		const current = variant.attributesMulti?.[attribute.slug] ?? [];
		const nextSet = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
		const nextMulti = { ...(variant.attributesMulti ?? {}) };
		const nextAttributes = { ...variant.attributes };
		const nextDisplay = { ...(variant.attributeDisplay ?? {}) };
		delete nextAttributes[attribute.slug];
		delete nextDisplay[attribute.slug];
		if (nextSet.length === 0) {
			delete nextMulti[attribute.slug];
		} else {
			nextMulti[attribute.slug] = nextSet;
		}
		onChange({
			...variant,
			attributes: nextAttributes,
			attributeDisplay: nextDisplay,
			attributesMulti: nextMulti,
		});
	}

	function selectOption(value: string) {
		if (allowMultiSelect) {
			toggleMultiValue(value);
			return;
		}

		const nextDisplay = { ...(variant.attributeDisplay ?? {}) };
		delete nextDisplay[attribute.slug];

		const nextMulti = { ...(variant.attributesMulti ?? {}) };
		delete nextMulti[attribute.slug];
		onChange({
			...variant,
			attributes: { ...variant.attributes, [attribute.slug]: value },
			attributeDisplay: nextDisplay,
			attributesMulti: nextMulti,
		});
	}

	const tabOptions = sortAttributeOptions(attribute.options, attribute.unit).map((option) => ({
		key: option.value,
		label: formatAttributeOptionLabel(option.label, attribute.unit),
	}));

	const selectedKeys = allowMultiSelect ? selectedValues : selectedValue ? [selectedValue] : [];

	return (
		<div className="flex flex-col gap-1.5 px-2.5 py-2 md:px-3 md:py-2.5">
			<span className={ATTRIBUTE_DIMENSION_LABEL_CLASS}>
				{attribute.label}
				{allowMultiSelect ? " (multi)" : ""}
			</span>
			<AttributeOptionTabRow ariaLabel={attribute.label} options={tabOptions} selectedKeys={selectedKeys} onSelect={(key) => selectOption(key)} />
			{hasMulti && selectedValues.length > 1 && (
				<p className="mt-1 text-[10.5px] text-[var(--color-ink-500)]">{selectedValues.length} values on this variant (shown together on the shop).</p>
			)}
			<FieldError message={error} />
		</div>
	);
}

export function VariantInStockToggle({ variant, onChange }: { variant: VariantDraft; onChange: (next: VariantDraft) => void }) {
	const isSelling = !variant.forceOutOfStock;

	function setSelling(next: boolean) {
		onChange({ ...variant, forceOutOfStock: !next });
	}

	return (
		<label className="inline-flex shrink-0 cursor-pointer" onClick={(event) => event.stopPropagation()}>
			<input
				type="checkbox"
				checked={isSelling}
				onChange={(event) => setSelling(event.target.checked)}
				aria-label={isSelling ? "Available for sale" : "Forced sold out"}
				className="sr-only"
			/>
			<span
				aria-hidden
				className={classNames(
					"relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
					isSelling ? "bg-[var(--color-ink-900)]" : "bg-[var(--color-ink-200)]",
				)}
			>
				<span className={classNames("absolute size-3 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform", isSelling ? "translate-x-3.5" : "translate-x-0.5")} />
			</span>
		</label>
	);
}

function SubLabel({ children }: { children: React.ReactNode }) {
	return <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return <p className="mt-1 text-[11.5px] font-semibold text-[var(--color-rose-700)]">{message}</p>;
}

function WarrantyDaysField({ value, onChange, error, compact = false }: { value: number | null; onChange: (value: number | null) => void; error?: string; compact?: boolean }) {
	const summary = value !== null && value > 0 ? formatWarrantyPeriod(value) : "No warranty period";

	const labelClass = classNames(
		"whitespace-nowrap font-semibold uppercase text-[var(--color-ink-500)]",
		compact ? "text-[10px] tracking-[0.12em]" : "text-[11px] tracking-[0.14em]",
	);

	const inputClass = classNames(
		"rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] focus:border-[var(--color-accent-500)] focus:outline-none",
		compact ? "h-8 w-[4.25rem] shrink-0 px-2 text-xs" : "w-full px-3 py-1.5 text-[14px]",
	);

	const summaryClass = classNames("whitespace-nowrap text-[var(--color-ink-500)]", compact ? "min-w-0 text-[10px]" : "text-[11px]");

	return (
		<label className={classNames("flex flex-col gap-0.5", compact ? "min-w-0 shrink-0" : "gap-1")}>
			<span className={labelClass}>Warranty (days)</span>
			<div className={classNames(compact ? "flex items-center gap-1.5" : "flex flex-col gap-1")}>
				<input
					type="number"
					value={value ?? ""}
					min={0}
					step={1}
					placeholder="—"
					onChange={(event) => {
						const raw = event.target.value;
						if (raw === "") {
							onChange(null);
							return;
						}
						const parsed = event.target.valueAsNumber;
						onChange(Number.isFinite(parsed) ? parsed : null);
					}}
					className={inputClass}
				/>
				<span className={summaryClass}>{summary}</span>
			</div>
			<FieldError message={error} />
		</label>
	);
}

function NumberField({
	label,
	value,
	min,
	onChange,
	error,
	compact = false,
	disabled = false,
}: {
	label: string;
	value: number;
	min: number;
	onChange: (value: number) => void;
	error?: string;
	compact?: boolean;
	disabled?: boolean;
}) {
	return (
		<label className={classNames("flex flex-col gap-0.5", compact ? "min-w-[5.5rem] flex-1 sm:max-w-[7rem]" : "gap-1")}>
			<span
				className={
					compact
						? "text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]"
						: "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]"
				}
			>
				{label}
			</span>
			<input
				type="number"
				value={value === 0 ? "" : value}
				min={min}
				disabled={disabled}
				placeholder="—"
				onChange={(event) => {
					const raw = event.target.value;
					if (raw === "") {
						onChange(0);
						return;
					}
					const parsed = event.target.valueAsNumber;
					onChange(Number.isFinite(parsed) ? parsed : 0);
				}}
				className={
					compact
						? "h-8 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 text-xs focus:border-[var(--color-accent-500)] focus:outline-none disabled:opacity-50"
						: "rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-[14px] focus:border-[var(--color-accent-500)] focus:outline-none"
				}
			/>
			<FieldError message={error} />
		</label>
	);
}
