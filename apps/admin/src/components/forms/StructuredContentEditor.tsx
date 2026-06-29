"use client";

/**
 * Reusable structured-content editor used on the customer-facing
 * Category, Grade, and Offer drawers. The shape matches
 * `StructuredContent` from `@store/shared` — one summary string plus an
 * ordered list of icon-tagged bullet rows.
 *
 * The editor never uploads anything or talks to the network; it owns
 * pure UI state and reports the next value through `onChange` so the
 * parent can include it in its submit payload.
 */

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from "lucide-react";
import { icons as lucideIcons } from "lucide-react";
import {
	STRUCTURED_CONTENT_BULLET_MAX_LENGTH,
	STRUCTURED_CONTENT_DEFAULT_BULLET_ICON,
	STRUCTURED_CONTENT_MAX_BULLETS,
	STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH,
	type StructuredContent,
	type StructuredContentBullet,
} from "@store/shared";

import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";

interface StructuredContentEditorProps {
	value: StructuredContent;
	onChange: (next: StructuredContent) => void;
	/** Label shown above the summary textarea. */
	summaryLabel?: string;
	/** Placeholder shown in the empty summary textarea. */
	summaryPlaceholder?: string;
	/** Number of rows for the summary textarea. */
	summaryRows?: number;
	/** Override the maximum allowed summary length per surface (cap is the schema max). */
	maxSummaryLength?: number;
	/** Label shown above the bullets list. */
	bulletsLabel?: string;
	/** Helper text shown under the bullets label. */
	bulletsHint?: string;
}

const LUCIDE_ICON_NAMES: string[] = Object.keys(lucideIcons)
	.filter((name) => /^[A-Z]/.test(name))
	.sort((left, right) => left.localeCompare(right));

export function StructuredContentEditor({
	value,
	onChange,
	summaryLabel = "Summary",
	summaryPlaceholder = "Short, customer-facing intro.",
	summaryRows = 3,
	maxSummaryLength = STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH,
	bulletsLabel = "Bullet points",
	bulletsHint = "Optional. Each bullet shows its icon plus a short line on storefront surfaces.",
}: StructuredContentEditorProps) {
	const summaryCap = Math.min(maxSummaryLength, STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH);
	const bullets = value.bullets ?? [];
	const canAddBullet = bullets.length < STRUCTURED_CONTENT_MAX_BULLETS;

	function setSummary(next: string) {
		onChange({ summary: next.slice(0, summaryCap), bullets });
	}

	function updateBullet(index: number, patch: Partial<StructuredContentBullet>) {
		const nextBullets = bullets.map((bullet, i) => (i === index ? { ...bullet, ...patch } : bullet));
		onChange({ summary: value.summary, bullets: nextBullets });
	}

	function addBullet() {
		if (!canAddBullet) return;
		onChange({
			summary: value.summary,
			bullets: [...bullets, { text: "", icon: STRUCTURED_CONTENT_DEFAULT_BULLET_ICON }],
		});
	}

	function removeBullet(index: number) {
		onChange({
			summary: value.summary,
			bullets: bullets.filter((_, i) => i !== index),
		});
	}

	function moveBullet(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= bullets.length) return;
		const next = [...bullets];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		onChange({ summary: value.summary, bullets: next });
	}

	return (
		<div className="reveal animate-in space-y-4 rounded-md border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/40 p-3">
			<div>
				<div className="mb-1 flex items-baseline justify-between gap-2">
					<label htmlFor="structured-content-summary" className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
						{summaryLabel}
					</label>
					<span className="text-[10.5px] text-[var(--color-ink-400)]">
						{value.summary.length}/{summaryCap}
					</span>
				</div>
				<textarea
					id="structured-content-summary"
					value={value.summary}
					onChange={(event) => setSummary(event.target.value)}
					maxLength={summaryCap}
					rows={summaryRows}
					placeholder={summaryPlaceholder}
					className="block w-full rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--color-ink-900)] focus:border-[var(--color-accent-500)] focus:outline-none"
				/>
			</div>

			<div>
				<div className="mb-1 flex items-baseline justify-between gap-2">
					<p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">{bulletsLabel}</p>
					<span className="text-[10.5px] text-[var(--color-ink-400)]">
						{bullets.length}/{STRUCTURED_CONTENT_MAX_BULLETS}
					</span>
				</div>
				<p className="mb-2 text-[11.5px] text-[var(--color-ink-500)]">{bulletsHint}</p>
				<ul className="space-y-2">
					{bullets.map((bullet, index) => (
						<li key={index} className="flex items-center gap-2 rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2">
							<InlineIconPicker value={bullet.icon} onChange={(icon) => updateBullet(index, { icon })} />
							<input
								type="text"
								value={bullet.text}
								onChange={(event) =>
									updateBullet(index, {
										text: event.target.value.slice(0, STRUCTURED_CONTENT_BULLET_MAX_LENGTH),
									})
								}
								placeholder="Short bullet copy"
								maxLength={STRUCTURED_CONTENT_BULLET_MAX_LENGTH}
								className="min-w-0 flex-1 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-2.5 py-1.5 text-[13px] text-[var(--color-ink-900)] focus:border-[var(--color-accent-500)] focus:outline-none"
							/>
							<div className="flex shrink-0 items-center gap-0.5">
								<IconButton label="Move up" disabled={index === 0} onClick={() => moveBullet(index, -1)}>
									<ArrowUp size={14} />
								</IconButton>
								<IconButton label="Move down" disabled={index === bullets.length - 1} onClick={() => moveBullet(index, 1)}>
									<ArrowDown size={14} />
								</IconButton>
								<IconButton label="Remove bullet" tone="danger" onClick={() => removeBullet(index)}>
									<Trash2 size={14} />
								</IconButton>
							</div>
						</li>
					))}
				</ul>
				<button
					type="button"
					onClick={addBullet}
					disabled={!canAddBullet}
					className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-ink-700)] hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Plus size={13} strokeWidth={2.3} />
					Add bullet
				</button>
			</div>
		</div>
	);
}

function IconButton({ children, label, onClick, disabled, tone }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
	const toneClass =
		tone === "danger"
			? "text-[var(--color-rose-700)] hover:bg-[var(--color-rose-100)]"
			: "text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-800)]";
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			disabled={disabled}
			className={`grid size-7 place-items-center rounded transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
		>
			{children}
		</button>
	);
}

function InlineIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
	const [isOpen, setIsOpen] = useState(false);
	const [isHydrated, setIsHydrated] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsHydrated(true);
	}, []);

	const trimmed = query.trim().toLowerCase();
	const visibleOptions = useMemo(() => {
		if (!trimmed) return LUCIDE_ICON_NAMES;
		return LUCIDE_ICON_NAMES.filter((name) => name.toLowerCase().includes(trimmed));
	}, [trimmed]);
	return (
		<>
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				aria-label={`Change icon (currently ${value})`}
				title={value}
				className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)] hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)]"
			>
				<LucideIconRenderer name={value} size={16} strokeWidth={2.2} />
			</button>
			{isOpen &&
				isHydrated &&
				createPortal(
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Pick bullet icon"
						className="animate-sheet-fade fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--color-ink-900)]/35 p-4"
						onClick={(event) => {
							if (event.target === event.currentTarget) setIsOpen(false);
						}}
					>
						{/* Concentric: inner icon grid tiles (rounded-md ≈ 6) + p-4
              (16) → outer 22 ≈ --radius-2xl (24, within 2px). */}
						<div className="animate-dialog-in flex max-h-[80vh] w-full max-w-2xl flex-col rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-[var(--color-ink-900)]">Pick bullet icon</p>
									<p className="mt-1 text-xs text-[var(--color-ink-500)]">Any lucide icon works — the storefront falls back to the surface default if data is ever missing.</p>
								</div>
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									aria-label="Close picker"
									className="rounded-md p-1.5 text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-deep)]"
								>
									<X size={16} />
								</button>
							</div>
							<label className="mt-3 flex items-center gap-2 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2">
								<Search size={15} className="text-[var(--color-ink-400)]" />
								<input
									type="search"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search icons"
									autoFocus
									className="min-w-0 flex-1 bg-transparent text-sm outline-none"
								/>
							</label>
							<div className="mt-3 grid flex-1 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-10">
								{visibleOptions.map((name) => (
									<button
										key={name}
										type="button"
										title={name}
										onClick={() => {
											onChange(name);
											setIsOpen(false);
											setQuery("");
										}}
										className={
											"grid min-h-11 place-items-center rounded-md border text-[var(--color-ink-700)] transition hover:border-[var(--color-accent-400)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-700)] " +
											(name === value ? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)]" : "border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]")
										}
									>
										<LucideIconRenderer name={name} size={18} strokeWidth={2.1} />
									</button>
								))}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
