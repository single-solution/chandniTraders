"use client";

/**
 * The admin SEO panel — a collapsible block mounted at the bottom of
 * every entity editor (Product, Category, Brand, Offer). Captures
 * optional per-entity overrides that the storefront's `composeSeoMeta`
 * will pick up; everything is auto-derived when these fields are blank.
 *
 * Pure controlled component. Parent owns the `SeoMeta` slice of state.
 */

import { useId } from "react";

import { classNames, SEO_META_FIELD_LIMITS, type SeoMeta } from "@store/shared";
import { ChecklistRow } from "@/app/settings/_components/SeoChecklistView";
import { Toggle } from "@/components/ui/Toggle";

interface SeoPanelProps {
	value: SeoMeta;
	onChange: (next: SeoMeta) => void;
	/** Compact summary line shown in the header (e.g. "Category · Brand · Product"). */
	contextLabel?: string;
	/**
	 * Optional resolved preview snippet shown above the form. Most editors
	 * pass the live `<title>` and `<meta description>` previews here so the
	 * admin can verify exactly what the storefront will render.
	 */
	previewSlot?: React.ReactNode;
	/**
	 * Optional checklist results to render inline validations.
	 */
	checklist?: import("@store/shared").SeoChecklistResult;
}

function clampLength(value: string, max: number): string {
	return value.length > max ? value.slice(0, max) : value;
}

function counterTone(len: number, min: number, max: number): string {
	if (len === 0) return "text-[color:var(--color-ink-400)]";
	if (len < min) return "text-amber-600";
	if (len > max) return "text-rose-600";
	return "text-emerald-600";
}

export function SeoPanel({ value, onChange, contextLabel, previewSlot, checklist }: SeoPanelProps) {
	const id = useId();

	const set = <K extends keyof SeoMeta>(key: K, next: SeoMeta[K]) => {
		onChange({ ...value, [key]: next });
	};

	return (
		<div className="space-y-6">
			{previewSlot && <div className="flex-1">{previewSlot}</div>}

			<div className="grid gap-6 md:grid-cols-2">
				<FieldRow
					label="Focus keyword"
					htmlFor={`${id}-focus`}
					hint="Primary keyword to analyze SEO score against."
					validations={checklist?.items.filter((item) => item.id.startsWith("keyword-"))}
				>
					<input
						id={`${id}-focus`}
						type="text"
						value={value.focusKeyword ?? ""}
						onChange={(event) => set("focusKeyword", clampLength(event.target.value, SEO_META_FIELD_LIMITS.focusKeyword))}
						placeholder="e.g. product name category"
						maxLength={SEO_META_FIELD_LIMITS.focusKeyword}
						className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-ink-200)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					/>
				</FieldRow>

				<FieldRow
					label="Title override"
					htmlFor={`${id}-title`}
					counter={`${(value.title ?? "").length} / 60`}
					counterTone={counterTone((value.title ?? "").length, 30, 60)}
					hint="Leave blank to use the auto-generated title."
					validations={checklist?.items.filter((item) => item.id === "title-length")}
				>
					<input
						id={`${id}-title`}
						type="text"
						value={value.title ?? ""}
						onChange={(event) => set("title", clampLength(event.target.value, SEO_META_FIELD_LIMITS.title))}
						maxLength={SEO_META_FIELD_LIMITS.title}
						placeholder="Auto-generated if blank"
						className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-ink-200)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					/>
				</FieldRow>
			</div>

			<FieldRow
				label="Description override"
				htmlFor={`${id}-desc`}
				counter={`${(value.description ?? "").length} / 160`}
				counterTone={counterTone((value.description ?? "").length, 120, 160)}
				hint="Custom description for search results. Recommended length is 120-160 characters."
				validations={checklist?.items.filter((item) => item.id === "description-length")}
			>
				<textarea
					id={`${id}-desc`}
					value={value.description ?? ""}
					rows={3}
					onChange={(event) => set("description", clampLength(event.target.value, SEO_META_FIELD_LIMITS.description))}
					maxLength={SEO_META_FIELD_LIMITS.description}
					placeholder="Auto-generated if blank"
					className="w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--color-ink-200)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
				/>
			</FieldRow>

			<div className="grid gap-6 md:grid-cols-2">
				<FieldRow label="Canonical URL" htmlFor={`${id}-canonical`} hint="Points to the preferred version of this page to avoid duplicate content.">
					<input
						id={`${id}-canonical`}
						type="url"
						value={value.canonicalUrl ?? ""}
						onChange={(event) => set("canonicalUrl", clampLength(event.target.value, SEO_META_FIELD_LIMITS.canonicalUrl))}
						maxLength={SEO_META_FIELD_LIMITS.canonicalUrl}
						placeholder="Defaults to the current page URL"
						className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-ink-200)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					/>
				</FieldRow>

				<FieldRow label="OG image URL" htmlFor={`${id}-og`} hint="Custom image URL for social media sharing.">
					<input
						id={`${id}-og`}
						type="url"
						value={value.ogImageUrl ?? ""}
						onChange={(event) => set("ogImageUrl", clampLength(event.target.value, SEO_META_FIELD_LIMITS.ogImageUrl))}
						maxLength={SEO_META_FIELD_LIMITS.ogImageUrl}
						placeholder="Defaults to the auto-generated OG image"
						className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-ink-200)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					/>
				</FieldRow>
			</div>

			<div className="flex flex-wrap items-center gap-6">
				<div className="flex items-center gap-3">
					<Toggle checked={Boolean(value.noindex)} onCheckedChange={(checked) => set("noindex", checked)} aria-label="Hide from search engines (noindex)" />
					<div>
						<p className="text-sm font-medium text-[var(--color-ink-900)]">Hide from search engines (noindex)</p>
						<p className="text-[11px] text-[var(--color-ink-400)]">Prevent this page from appearing in search results.</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<Toggle checked={Boolean(value.nofollow)} onCheckedChange={(checked) => set("nofollow", checked)} aria-label="Ignore links (nofollow)" />
					<div>
						<p className="text-sm font-medium text-[var(--color-ink-900)]">Ignore links (nofollow)</p>
						<p className="text-[11px] text-[var(--color-ink-400)]">Tell search engines not to follow links on this page.</p>
					</div>
				</div>
			</div>
		</div>
	);
}

interface FieldRowProps {
	label: string;
	htmlFor: string;
	counter?: string;
	counterTone?: string;
	hint?: string;
	validations?: import("@store/shared").SeoChecklistItem[];
	children: React.ReactNode;
}

function FieldRow({ label, htmlFor, counter, counterTone, hint, validations, children }: FieldRowProps) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-3">
				<label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-500)]">
					{label}
				</label>
				{counter ? <span className={`text-xs ${counterTone ?? ""}`}>{counter}</span> : null}
			</div>
			{children}
			{hint ? <p className="text-[11px] text-[color:var(--color-ink-400)]">{hint}</p> : null}
			{validations && validations.length > 0 ? (
				<ul className="space-y-1.5 pt-1">
					{validations.map((item) => (
						<ChecklistRow key={item.id} item={item} />
					))}
				</ul>
			) : null}
		</div>
	);
}
