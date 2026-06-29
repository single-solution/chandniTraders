"use client";

/**
 * Storefront-styled mini renderers for category workspace preview panels.
 * Pure props only — no fetches, routing, or context.
 */

import type { ReactNode } from "react";
import { formatAttributeOptionLabel, type IconName, type StructuredContent } from "@store/shared";
import type { AdminAttribute, AdminAttributeOption } from "@/types/models";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import { StructuredContentCompactPreview, StructuredContentFullPreview } from "@/components/forms/StructuredContentRenderer";
import { formatRelativeDate } from "@store/shared";

/* --------------------------------------------------------------------------
 * CategoryCardPreview — homepage category grid tile
 * ------------------------------------------------------------------------ */

interface CategoryDraft {
	label: string;
	description: string;
	icon: IconName;
	isActive: boolean;
	content: StructuredContent;
}

export function CategoryCardPreview({ category }: { category: CategoryDraft }) {
	const summary = category.content?.summary?.trim() || category.description || "Describe the category so customers know what to expect.";
	const bullets = category.content?.bullets ?? [];
	return (
		<div className="relative flex min-h-[200px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-canvas-deep)] p-5">
			<span
				className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-surface)] text-[var(--color-ink-900)] shadow-[var(--shadow-sm)]"
				aria-hidden
			>
				<LucideIconRenderer name={category.icon} size={22} strokeWidth={2.2} />
			</span>
			<div className="mt-4 flex flex-1 flex-col">
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-[20px] font-semibold tracking-tight text-[var(--color-ink-900)]">{category.label || "Untitled category"}</h3>
					{!category.isActive && (
						<span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-500)]">
							Soon
						</span>
					)}
				</div>
				<p className="mt-1 text-[14px] leading-snug text-[var(--color-ink-700)]">{summary}</p>
				{bullets.length > 0 && (
					<StructuredContentFullPreview
						content={{ summary: "", bullets }}
						maxBullets={3}
						iconColor="var(--color-accent-700)"
						iconSizeClass="size-3"
						iconSize={11}
						className="mt-4"
						bulletItemClassName="text-[12.5px] text-[var(--color-ink-700)]"
					/>
				)}
				<p className="mt-auto pt-4 text-[12.5px] font-semibold text-[var(--color-accent-700)]">Browse {(category.label || "category").toLowerCase()} →</p>
			</div>
		</div>
	);
}

/** Compact shop-selector tile preview — icon, label, description (no bullets). */
export function CategoryShopSelectorPreview({ category }: { category: CategoryDraft }) {
	return (
		<div className="grid grid-cols-3 gap-2 p-3">
			<div className="relative flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
				<LucideIconRenderer name={category.icon} size={22} strokeWidth={2.2} aria-hidden className="shrink-0" />
				<div className="min-w-0 flex-1">
					<p className="truncate text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)]">{category.label || "Category"}</p>
					<StructuredContentCompactPreview
						content={category.content}
						fallback={category.description || "Short category description."}
						clampLines={2}
						className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--color-ink-600)]"
					/>
				</div>
			</div>
			<div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 p-3 text-[11px] italic text-[var(--color-ink-400)]">
				sibling
			</div>
			<div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 p-3 text-[11px] italic text-[var(--color-ink-400)]">
				sibling
			</div>
		</div>
	);
}

export function CategoryHeaderPreview({ category }: { category: CategoryDraft }) {
	return (
		<div className="flex items-center gap-4 bg-gradient-to-b from-[var(--color-canvas-deep)] to-[var(--color-canvas)] px-4 py-5">
			<CategoryIcon category={category} size={56} />
			<div className="min-w-0">
				<p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-700)]">Storefront</p>
				<h1 className="text-[18px] font-semibold text-[var(--color-ink-900)]">{category.label || "Untitled"}</h1>
				<StructuredContentFullPreview
					content={category.content}
					fallback={category.description || "Storefront tagline appears here."}
					iconColor="var(--color-accent-700)"
					iconSize={12}
					iconSizeClass="size-3"
					className="mt-0.5 text-[11.5px] text-[var(--color-ink-600)]"
					bulletItemClassName="text-[11px] text-[var(--color-ink-700)]"
					maxBullets={4}
				/>
			</div>
		</div>
	);
}

export function CategoryNavChipPreview({ category }: { category: CategoryDraft }) {
	return (
		<div className="flex items-center gap-2 px-3 py-2.5">
			<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--color-ink-800)]">
				<CategoryIcon category={category} size={16} compact />
				{category.label || "Category"}
			</span>
			<span className="text-[12px] text-[var(--color-ink-400)]">· Home · Shop</span>
		</div>
	);
}

function CategoryIcon({ category, size, compact = false }: { category: CategoryDraft; size: number; compact?: boolean }) {
	return (
		<span
			className={"inline-flex items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-ink-700)]" + (compact ? "" : " shadow-[var(--shadow-sm)]")}
			style={{ width: size, height: size }}
			aria-hidden
		>
			<LucideIconRenderer name={category.icon} size={Math.round(size * 0.52)} strokeWidth={2.2} />
		</span>
	);
}

/* --------------------------------------------------------------------------
 * BrandChipPreview / BrandFilterRowPreview
 * ------------------------------------------------------------------------ */

interface BrandDraft {
	name: string;
	isActive: boolean;
}

export function BrandChipPreview({ brand }: { brand: BrandDraft }) {
	return (
		<div className="flex items-center gap-2 p-3">
			<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-ink-800)]">
				{brand.name || "Brand"}
			</span>
			<span className="text-[11.5px] text-[var(--color-ink-400)]">on Product card</span>
		</div>
	);
}

export function BrandFilterRowPreview({ brand, siblingNames }: { brand: BrandDraft; siblingNames: string[] }) {
	return (
		<div className="p-3">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Brand</p>
			<ul className="mt-1.5 space-y-1">
				<li className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-accent-50)] px-2 py-1 text-[12.5px] font-semibold text-[var(--color-ink-900)]">
					<span className="truncate">{brand.name || "Brand"}</span>
					<span className="text-[10px] text-[var(--color-ink-400)]">·</span>
				</li>
				{siblingNames.slice(0, 3).map((name) => (
					<li key={name} className="flex items-center justify-between gap-2 px-2 py-1 text-[12px] text-[var(--color-ink-700)]">
						<span className="truncate">{name}</span>
						<span className="text-[10px] text-[var(--color-ink-400)]">·</span>
					</li>
				))}
				{siblingNames.length === 0 && <li className="px-2 py-1 text-[11.5px] italic text-[var(--color-ink-400)]">More brands will appear here.</li>}
			</ul>
		</div>
	);
}

/* --------------------------------------------------------------------------
 * Offer previews
 * ------------------------------------------------------------------------ */

interface OfferDraft {
	title: string;
	discountLabel: string;
	badgeLabel: string;
	color: string;
	expiresAt: string;
	content: StructuredContent;
}

/** Mirrors `OfferCard` compact (`sm`) — homepage / list strip. */
export function OfferCardCompactPreview({ offer }: { offer: OfferDraft }) {
	const background = `linear-gradient(135deg, ${offer.color}, ${darkenHex(offer.color, 0.22)})`;
	return (
		<div className="relative flex min-h-32 flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] p-3.5 text-white" style={{ background }}>
			<div className="relative flex items-center justify-between">
				<span className="inline-flex rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">{offer.badgeLabel || "Limited"}</span>
				<span className="text-[10px] text-white/85">{offer.expiresAt ? formatRelativeDate(offer.expiresAt) : "No expiry"}</span>
			</div>
			<div className="relative space-y-1">
				<p className="text-[10px] uppercase tracking-[0.18em] text-white/85">{offer.discountLabel || "Up to 22% off"}</p>
				<h3 className="text-sm font-semibold leading-tight tracking-tight">{offer.title || "Offer title"}</h3>
				<StructuredContentCompactPreview content={offer.content} fallback={offer.content.summary} clampLines={2} className="text-[12px] leading-snug text-white/85" />
			</div>
		</div>
	);
}

/** Mirrors deals page `DealOfferToggleButton` (collapsed). */
export function OfferCardFullPreview({ offer }: { offer: OfferDraft }) {
	return (
		<div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[var(--color-accent-400)] bg-[var(--color-accent-500)] px-3 py-2 text-[var(--color-ink-900)] shadow-[0_8px_24px_-14px_color-mix(in_srgb,var(--color-accent-500)_65%,transparent)]">
			<span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-800)]">
				{offer.badgeLabel || "Limited"}
			</span>
			<span className="text-sm font-extrabold text-[var(--color-accent-700)]">{offer.discountLabel || "Up to 22% off"}</span>
			<span className="text-[13px] font-medium leading-snug text-[var(--color-ink-800)]">{offer.title || "Offer title"}</span>
			<span className="text-xs font-semibold text-[var(--color-ink-700)]">Details</span>
		</div>
	);
}

/** Fallback matches `--color-accent-500` when the input is not a hex color. */
const ACCENT_HEX_FALLBACK = "#e1ff51";

function darkenHex(hex: string | undefined, amount: number): string {
	if (!hex || typeof hex !== "string") {
		return ACCENT_HEX_FALLBACK;
	}
	const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) {
		return hex;
	}
	const num = Number.parseInt(match[1], 16);
	const red = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
	const green = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
	const blue = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
	return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}
/* --------------------------------------------------------------------------
 * AttributePreviews
 * ------------------------------------------------------------------------ */

interface AttributeDraft {
	label: string;
	unit?: string;
	cardPosition: AdminAttribute["cardPosition"];
	options: AdminAttributeOption[];
}

function optionDisplayLabel(option: AdminAttributeOption, attributeUnit?: string): string {
	return formatAttributeOptionLabel(option.label, attributeUnit);
}

export function AttributeSpecStripPreview({ attribute }: { attribute: AttributeDraft }) {
	return (
		<div className="p-3">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{attribute.label || "Attribute"}</p>
			<div className="mt-1.5 flex flex-wrap gap-1.5">
				{attribute.options.length === 0 && <span className="text-[11.5px] italic text-[var(--color-ink-400)]">Add an option to preview.</span>}
				{attribute.options.slice(0, 5).map((opt) => (
					<span
						key={opt.value}
						className="inline-flex items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-2 py-0.5 text-[11.5px] text-[var(--color-ink-800)]"
					>
						{optionDisplayLabel(opt, attribute.unit)}
					</span>
				))}
			</div>
		</div>
	);
}

export function AttributeFilterGroupPreview({ attribute }: { attribute: AttributeDraft }) {
	return (
		<div className="p-3">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{attribute.label || "Attribute"}</p>
			<ul className="mt-1.5 space-y-1">
				{attribute.options.length === 0 && <li className="text-[11.5px] italic text-[var(--color-ink-400)]">No options yet.</li>}
				{attribute.options.slice(0, 6).map((opt) => (
					<li key={opt.value} className="flex items-center gap-2 text-[12px] text-[var(--color-ink-700)]">
						<span className="inline-block size-3 rounded border border-[var(--color-ink-300)] bg-[var(--color-surface)]" />
						<span className="truncate rounded-full px-1.5 py-0.5 text-[12px] text-[var(--color-ink-700)]">{optionDisplayLabel(opt, attribute.unit)}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function AttributeCardChipPreview({ attribute }: { attribute: AttributeDraft }) {
	const first = attribute.options[0];
	return (
		<div className="flex items-center gap-2 p-3">
			<div className="aspect-square w-14 rounded-md bg-[var(--color-ink-100)]" />
			<div className="flex-1">
				<p className="text-[12px] font-semibold text-[var(--color-ink-900)]">Sample product</p>
				<p className="text-[11px] text-[var(--color-ink-500)]">Brand · Rs 0</p>
				<div className="mt-1.5 flex flex-wrap gap-1">
					{first ? (
						<span className="inline-flex items-center rounded-full bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-800)]">
							{optionDisplayLabel(first, attribute.unit)}
						</span>
					) : (
						<span className="text-[10.5px] italic text-[var(--color-ink-400)]">Add an option to preview.</span>
					)}
				</div>
			</div>
		</div>
	);
}

export type { AttributeDraft, BrandDraft, CategoryDraft, OfferDraft };
