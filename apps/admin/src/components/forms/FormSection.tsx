import type { ReactNode } from "react";

interface FormSectionProps {
	title: string;
	description?: string;
	children: ReactNode;
}

/**
 * Stacked section: title and description sit above the form body, body
 * fills the full width of its parent. Replaces the older two-column grid
 * which left big empty bands on the right of dense sections (toggle
 * lists, multi-row forms) — the title column was thin and the form
 * column was capped, neither using the panel well. Inputs that should
 * stay short can still cap themselves with `containerClassName="max-w-md"`.
 */
export function FormSection({ title, description, children }: FormSectionProps) {
	return (
		<section className="reveal animate-in border-b border-[var(--color-ink-100)] py-4 first:pt-0 last:border-b-0 md:py-6">
			<header className="mb-3 md:mb-4">
				<h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)] md:text-sm">{title}</h3>
				{Boolean(description) && <p className="mt-1 max-w-prose text-[11.5px] leading-relaxed text-[var(--color-ink-500)] md:mt-1.5 md:text-xs">{description}</p>}
			</header>
			<div className="reveal-stagger space-y-3 md:space-y-4">{children}</div>
		</section>
	);
}
