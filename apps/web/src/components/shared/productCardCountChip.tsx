"use client";

import { Award } from "lucide-react";
import type { ReactNode } from "react";

export function ProductListingCountChip({ label }: { label: ReactNode }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-x-1 whitespace-nowrap rounded-[var(--radius-full)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-[var(--color-ink-700)] shadow-sm md:gap-1 md:px-2 md:py-0.5 md:text-[11px]">
			<Award size={9} className="shrink-0 md:size-[11px]" aria-hidden />
			<span>{label}</span>
		</span>
	);
}
