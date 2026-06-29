"use client";

import type { CSSProperties } from "react";

/**
 * Lightweight ambient layer for content sections — same DNA as the
 * hero's HeroAmbience but tuned way down so it can sit behind any
 * section without competing with text.
 *
 *   • Pure CSS keyframes — no JS, no per-frame work, safe to drop on
 *     every page.
 *   • Renders behind content via `position: absolute; inset: 0;
 *     pointer-events: none; z-0;` so the parent section just needs
 *     `position: relative; overflow: hidden;`.
 *   • Three optional intensities so the ambience reads progressively
 *     fainter the deeper you scroll on a page.
 *
 * Intentionally no spotlight here — that effect is hero-only.
 */
export type SectionAmbienceIntensity = "soft" | "medium" | "strong";

interface SectionAmbienceProps {
	intensity?: SectionAmbienceIntensity;
	/** Optional override: position the primary orb on the left instead
	 *  of the right so neighbouring sections don't echo each other. */
	side?: "left" | "right";
	className?: string;
}

const INTENSITY_OPACITY: Record<SectionAmbienceIntensity, number> = {
	soft: 0.28,
	medium: 0.45,
	strong: 0.6,
};

export function SectionAmbience({ intensity = "soft", side = "right", className = "" }: SectionAmbienceProps) {
	const opacity = INTENSITY_OPACITY[intensity];
	return (
		<div className={`section-ambience ${className}`.trim()} aria-hidden style={{ "--section-ambience-opacity": String(opacity) } as CSSProperties} data-side={side}>
			<span className="section-ambience-orb section-ambience-orb--a" />
			<span className="section-ambience-orb section-ambience-orb--b" />
		</div>
	);
}
