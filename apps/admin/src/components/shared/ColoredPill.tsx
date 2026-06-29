import type { CSSProperties, ReactNode } from "react";
import { classNames, coloredPillStyle, softColoredPillStyleOnDark, softColoredPillStyleOnLight } from "@store/shared";

/**
 * `solid`      — full-saturation chip (original behaviour). Use when there's
 *                only one coloured chip on screen and it needs to pop.
 * `soft-light` — the source colour blended toward the brand canvas. Use when
 *                multiple coloured chips appear together on a light surface
 *                (product grids, deal rows, attribute swatch trays). The
 *                tonal range stays harmonious instead of clashing.
 * `soft-dark`  — same idea but tuned for `--color-ink-900` sections (home
 *                grades band, hero callouts).
 */
export type ColoredPillTone = "solid" | "soft-light" | "soft-dark";

interface ColoredPillProps {
	backgroundColor: string;
	tone?: ColoredPillTone;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	"aria-label"?: string;
}

export function ColoredPill({ backgroundColor, tone = "soft-light", children, className, style, "aria-label": ariaLabel }: ColoredPillProps) {
	const toneStyle =
		tone === "solid" ? coloredPillStyle(backgroundColor) : tone === "soft-dark" ? softColoredPillStyleOnDark(backgroundColor) : softColoredPillStyleOnLight(backgroundColor);

	return (
		<span className={classNames("inline-flex items-center whitespace-nowrap", className)} style={{ ...toneStyle, ...style }} aria-label={ariaLabel}>
			{children}
		</span>
	);
}
