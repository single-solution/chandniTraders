"use client";

import Link from "next/link";
import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";
import type { AdminCategory } from "@/types/models";

export function WizardSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
	return (
		<section className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
			<header className="mb-3 flex items-center justify-between gap-2">
				<h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">{title}</h2>
				{action}
			</header>
			{children}
		</section>
	);
}

export function WizardEmptyHint({ children }: { children: React.ReactNode }) {
	return (
		<p className="rounded-md border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-3 py-3 text-[12.5px] text-[var(--color-ink-500)]">{children}</p>
	);
}

export function CategoryOptionButton({ category, isSelected, onSelect }: { category: AdminCategory; isSelected: boolean; onSelect: () => void }) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold transition " +
				(isSelected
					? "border-[var(--color-accent-500)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
					: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)]")
			}
		>
			<LucideIconRenderer name={category.icon} size={14} strokeWidth={2.2} aria-hidden />
			{category.label}
		</button>
	);
}

export function WizardFieldError({ message }: { message?: string }) {
	if (!message) return null;
	return <p className="mt-2 text-[12px] font-semibold text-[var(--color-rose-700)]">{message}</p>;
}

export function CategoriesEmptyHint() {
	return (
		<WizardEmptyHint>
			No categories yet — head to{" "}
			<Link href="/categories" className="font-semibold text-[var(--color-accent-700)] underline">
				Categories
			</Link>{" "}
			to create one before adding products.
		</WizardEmptyHint>
	);
}
