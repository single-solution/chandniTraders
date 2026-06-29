"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { icons as lucideIcons, Search, X } from "lucide-react";

import { LucideIconRenderer } from "./LucideIconRenderer";

interface LucideIconOption {
	name: string;
	keywords: string;
}

interface LucideIconPickerProps {
	value: string;
	onChange: (icon: string) => void;
	label?: string;
	description?: string;
}

const LUCIDE_ICON_OPTIONS: LucideIconOption[] = Object.keys(lucideIcons)
	.filter((name) => /^[A-Z]/.test(name))
	.map((name) => ({
		name,
		keywords: splitLucideIconName(name).toLowerCase(),
	}))
	.sort((left, right) => left.name.localeCompare(right.name));

export function LucideIconPicker({ value, onChange, label = "Icon", description = "Search and pick any lucide icon." }: LucideIconPickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isHydrated, setIsHydrated] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsHydrated(true);
	}, []);

	const trimmedQuery = query.trim().toLowerCase();
	const visibleOptions = useMemo(() => {
		if (!trimmedQuery) {
			return LUCIDE_ICON_OPTIONS;
		}
		return LUCIDE_ICON_OPTIONS.filter((option) => option.name.toLowerCase().includes(trimmedQuery) || option.keywords.includes(trimmedQuery));
	}, [trimmedQuery]);

	return (
		<div className="rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
			<p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">{label}</p>
			<div className="mt-2 flex items-center gap-3">
				<span className="grid size-12 place-items-center rounded-md border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]" aria-hidden>
					<LucideIconRenderer name={value} size={24} strokeWidth={2.2} />
				</span>
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)]"
				>
					Pick icon
				</button>
				<p className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-ink-500)]">{value}</p>
			</div>
			{isOpen &&
				isHydrated &&
				createPortal(
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Pick icon"
						className="animate-sheet-fade fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--color-ink-900)]/35 p-4"
					>
						{/* Concentric: inner icon grid tiles use Tailwind rounded-md
              (6) at p-4 (16) → outer 22 ≈ --radius-2xl (24, within 2px). */}
						<div className="animate-dialog-in flex max-h-[82vh] w-full max-w-3xl flex-col rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-[var(--color-ink-900)]">Pick an icon</p>
									<p className="mt-1 text-xs text-[var(--color-ink-500)]">{description}</p>
								</div>
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									aria-label="Close icon picker"
									className="rounded-md p-1.5 text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-deep)]"
								>
									<X size={16} />
								</button>
							</div>
							<label className="mt-4 flex items-center gap-2 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2">
								<Search size={15} className="text-[var(--color-ink-400)]" />
								<input
									type="search"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search icons"
									className="min-w-0 flex-1 bg-transparent text-sm outline-none"
									autoFocus
								/>
							</label>
							<div className="mt-4 grid flex-1 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
								{visibleOptions.map((option) => (
									<button
										key={option.name}
										type="button"
										onClick={() => {
											onChange(option.name);
											setIsOpen(false);
										}}
										title={splitLucideIconName(option.name)}
										className={
											"grid min-h-14 place-items-center rounded-md border text-[var(--color-ink-700)] transition hover:border-[var(--color-accent-400)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-700)] " +
											(value === option.name ? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)]" : "border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]")
										}
									>
										<LucideIconRenderer name={option.name} size={22} strokeWidth={2.1} />
									</button>
								))}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}

function splitLucideIconName(name: string) {
	return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}
