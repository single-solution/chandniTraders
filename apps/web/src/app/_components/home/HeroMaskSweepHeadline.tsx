/**
 * Hero lockup — INSPECTED (outline, smaller) + TRUSTED (pakGreen fill,
 * larger). A single lime bar sweeps L→R on both lines in sync: erases the
 * strong outline on INSPECTED while painting the fill onto TRUSTED.
 * Both words use a modest scale transform anchored outward so they never collide.
 *
 * Typography: system grotesque stack (SF Pro on Apple, Segoe UI on
 * Windows, Roboto on Android, Inter elsewhere) at weight 900. We
 * intentionally avoid the storefront sans (`var(--font-sans)` →
 * Bricolage Grotesque) because its weight axis caps at 800. The
 * display token (Anton) is wrong too — tall condensed face, not a
 * grotesque.
 *
 * WebKit text-stroke is applied via inline style because the Tailwind
 * arbitrary class `[-webkit-text-stroke:...]` is parsed as a
 * negative-prefixed class and doesn't emit the property.
 */

import type { CSSProperties } from "react";

const HEADLINE_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Inter", Roboto, system-ui, sans-serif';

type HeroMaskVariant = "mobile" | "desktop";
type HeroHeadlineDensity = "default" | "compact";

interface HeroMaskSweepHeadlineProps {
	variant: HeroMaskVariant;
	align?: "center" | "left";
	density?: HeroHeadlineDensity;
}

interface WordSpec {
	fontSize: number;
	letterSpacing: string;
}

/** Vertical stretch — default stays modest; compact (catalog banner) reads taller. */
const SCALE_BY_DENSITY = {
	default: { x: 1.06, y: 1.12 },
	compact: { x: 1.06, y: 1.28 },
} as const;
/** Matches `line-height` on `baseStyle`. */
const LINE_HEIGHT = 0.92;

function resolveScale(density: HeroHeadlineDensity) {
	return SCALE_BY_DENSITY[density];
}

/**
 * scaleY visually extends the rendered glyph past its layout box.
 * Without compensation, the flex parent's `justify-evenly` measures
 * the unscaled box and leaves a smaller visual gap above `Inspected.`
 * (origin: bottom → overflow upward) and below `Trusted.` (origin:
 * top → overflow downward) than between the other groups. We push
 * the layout box out by the exact overflow amount so the rendered
 * headline claims its true visual footprint.
 */
function scaleOverflow(fontSize: number, scaleY: number): number {
	return Math.ceil(fontSize * LINE_HEIGHT * (scaleY - 1));
}

/**
 * Mobile sizing is constrained by physical viewport width. `TRUSTED`
 * uses `whiteSpace: nowrap`, so its rendered width must fit inside
 * narrow viewports; positive tracking + scaleX are balanced with a
 * slightly smaller mobile TRUSTED size when needed.
 */
/** Neutral-to-slightly-tight tracking — avoids the old cramped -0.07em but not loose either. */
const INSPECTED_SPEC: Record<HeroMaskVariant, WordSpec> = {
	mobile: { fontSize: 54, letterSpacing: "-0.01em" },
	desktop: { fontSize: 104, letterSpacing: "-0.015em" },
};

const TRUSTED_SPEC: Record<HeroMaskVariant, WordSpec> = {
	mobile: { fontSize: 80, letterSpacing: "-0.025em" },
	desktop: { fontSize: 166, letterSpacing: "-0.02em" },
};

const INSPECTED_SPEC_COMPACT: Record<HeroMaskVariant, WordSpec> = {
	mobile: { fontSize: 50, letterSpacing: "0em" },
	desktop: { fontSize: 92, letterSpacing: "-0.01em" },
};

const TRUSTED_SPEC_COMPACT: Record<HeroMaskVariant, WordSpec> = {
	mobile: { fontSize: 72, letterSpacing: "-0.02em" },
	desktop: { fontSize: 144, letterSpacing: "-0.015em" },
};

function baseStyle(spec: WordSpec, fontWeight = 900): CSSProperties {
	return {
		fontFamily: HEADLINE_FONT_STACK,
		fontWeight,
		textTransform: "uppercase",
		lineHeight: LINE_HEIGHT,
		whiteSpace: "nowrap",
		display: "block",
		fontSize: spec.fontSize,
		letterSpacing: spec.letterSpacing,
	};
}

function outlineStyle(spec: WordSpec, strokeWidth: number, opacity = 1, fontWeight = 900): CSSProperties {
	return {
		...baseStyle(spec, fontWeight),
		color: "transparent",
		WebkitTextStroke: `${strokeWidth}px var(--color-ink-900)`,
		paintOrder: "stroke fill",
		opacity,
	};
}

function fillStyle(spec: WordSpec, fontWeight = 900): CSSProperties {
	return {
		...baseStyle(spec, fontWeight),
		color: "var(--color-accent-deep)",
	};
}

function MaskSweepLine({ mode, ghostStyle, fullStyle, children }: { mode: "paint" | "erase"; ghostStyle: CSSProperties; fullStyle: CSSProperties; children: string }) {
	const fullAnim = mode === "paint" ? "hero-mask-sweep__full--paint" : "hero-mask-sweep__full--erase";

	return (
		<span className="hero-mask-sweep-line relative inline-block" aria-hidden>
			<span style={ghostStyle}>{children}</span>
			<span className={`hero-mask-sweep__full absolute inset-0 ${fullAnim}`} style={fullStyle}>
				{children}
			</span>
			<span className="hero-mask-sweep__bar" />
		</span>
	);
}

export function HeroMaskSweepHeadline({ variant, align = "center", density = "default" }: HeroMaskSweepHeadlineProps) {
	const isCompact = density === "compact";
	const inspectedSpec = isCompact ? INSPECTED_SPEC_COMPACT[variant] : INSPECTED_SPEC[variant];
	const trustedSpec = isCompact ? TRUSTED_SPEC_COMPACT[variant] : TRUSTED_SPEC[variant];
	const { x: scaleX, y: scaleY } = resolveScale(density);
	const headlineWeight = 900;
	const alignClass = align === "left" ? "items-start" : "items-center";
	const xOrigin = align === "left" ? "0%" : "50%";
	const mobileInspectedStroke = isCompact ? 0.9 : 0.8;
	const mobileTrustedStroke = isCompact ? 1.1 : 1;
	const desktopInspectedStroke = isCompact ? 1.15 : 1;
	const desktopTrustedStroke = isCompact ? 1.55 : 1.4;

	return (
		<h1 className={`flex flex-col ${alignClass}`}>
			<span className="sr-only">Inspected Trusted</span>
			<span
				className="inline-block"
				style={{
					transform: `scale(${scaleX}, ${scaleY})`,
					transformOrigin: `${xOrigin} 100%`,
					marginTop: scaleOverflow(inspectedSpec.fontSize, scaleY),
				}}
			>
				<MaskSweepLine
					mode="erase"
					ghostStyle={outlineStyle(inspectedSpec, variant === "mobile" ? mobileInspectedStroke : desktopInspectedStroke, 0.35, headlineWeight)}
					fullStyle={outlineStyle(inspectedSpec, variant === "mobile" ? (isCompact ? 1.05 : 1) : desktopInspectedStroke, 1, headlineWeight)}
				>
					Inspected
				</MaskSweepLine>
			</span>
			<span
				className="inline-block"
				style={{
					transform: `scale(${scaleX}, ${scaleY})`,
					transformOrigin: `${xOrigin} 0%`,
					marginBottom: scaleOverflow(trustedSpec.fontSize, scaleY),
				}}
			>
				<MaskSweepLine
					mode="paint"
					ghostStyle={outlineStyle(trustedSpec, variant === "mobile" ? mobileTrustedStroke : desktopTrustedStroke, 0.35, headlineWeight)}
					fullStyle={fillStyle(trustedSpec, headlineWeight)}
				>
					Trusted
				</MaskSweepLine>
			</span>
		</h1>
	);
}
