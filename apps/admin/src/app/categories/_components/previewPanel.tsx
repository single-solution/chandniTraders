"use client";

/**
 * Live-preview frame for category-workspace editors — stacked tiles per storefront surface.
 */

import type { ReactNode } from "react";
import { Info } from "lucide-react";

interface PreviewTile {
	/** "Appears on: Homepage category grid", "Appears on: Filter sidebar"… */
	surfaceLabel: string;
	/** Optional dimension hint shown under the tile body. */
	dimensionNote?: string;
	body: ReactNode;
}

interface PreviewPanelProps {
	title?: string;
	tiles: PreviewTile[];
	/** Optional hint text shown under the panel header. */
	hint?: string;
}

export function PreviewPanel({ title = "Live preview", tiles, hint }: PreviewPanelProps) {
	return (
		<aside className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] p-3">
			<header className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">{title}</p>
					{hint && (
						<p className="mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-[var(--color-ink-500)]">
							<Info size={11} className="mt-0.5 shrink-0" />
							<span>{hint}</span>
						</p>
					)}
				</div>
			</header>
			<div className="flex flex-col gap-3">
				{tiles.map((tile, index) => (
					<article key={`${tile.surfaceLabel}-${index}`} className="flex flex-col gap-1.5 rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2.5">
						<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{tile.surfaceLabel}</p>
						<div className="overflow-hidden rounded-md bg-[var(--color-canvas)]">{tile.body}</div>
						{tile.dimensionNote && <p className="text-[10.5px] text-[var(--color-ink-400)]">{tile.dimensionNote}</p>}
					</article>
				))}
			</div>
		</aside>
	);
}
