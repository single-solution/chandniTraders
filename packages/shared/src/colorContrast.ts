/**
 * WCAG relative luminance helpers for colored pills (grade + attribute chips).
 * Picks light or dark label text based on background brightness.
 */

const DEFAULT_LIGHT_TEXT = "#ffffff";
const DEFAULT_DARK_TEXT = "#111827";

/** Luminance threshold — below this, use light (white) text. */
const DEFAULT_LUMINANCE_THRESHOLD = 0.45;

export interface ContrastTextOptions {
	lightText?: string;
	darkText?: string;
	/** 0–1; lower = more backgrounds count as "dark". Default 0.45. */
	threshold?: number;
}

const COLOR_CHANNEL_MAX = 255;
const WCAG_LOW_LUMINANCE_THRESHOLD = 0.03928;
const WCAG_LOW_LUMINANCE_DIVISOR = 12.92;
const WCAG_HIGH_LUMINANCE_OFFSET = 0.055;
const WCAG_HIGH_LUMINANCE_DIVISOR = 1.055;
const WCAG_HIGH_LUMINANCE_POWER = 2.4;

function channelToLinear(channel: number): number {
	const normalized = channel / COLOR_CHANNEL_MAX;
	return normalized <= WCAG_LOW_LUMINANCE_THRESHOLD
		? normalized / WCAG_LOW_LUMINANCE_DIVISOR
		: ((normalized + WCAG_HIGH_LUMINANCE_OFFSET) / WCAG_HIGH_LUMINANCE_DIVISOR) ** WCAG_HIGH_LUMINANCE_POWER;
}

const LUMINANCE_WEIGHT_RED = 0.2126;
const LUMINANCE_WEIGHT_GREEN = 0.7152;
const LUMINANCE_WEIGHT_BLUE = 0.0722;

function relativeLuminance(red: number, green: number, blue: number): number {
	return LUMINANCE_WEIGHT_RED * channelToLinear(red) + LUMINANCE_WEIGHT_GREEN * channelToLinear(green) + LUMINANCE_WEIGHT_BLUE * channelToLinear(blue);
}

/**
 * Parses `#rgb` or `#rrggbb` (optional alpha ignored). Returns null if invalid.
 */
export function parseHexColor(input: string): { red: number; green: number; blue: number } | null {
	const trimmed = input.trim();
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
	if (!match) {
		return null;
	}
	const hex = match[1];
	if (hex.length === 3) {
		return {
			red: parseInt(hex[0] + hex[0], 16),
			green: parseInt(hex[1] + hex[1], 16),
			blue: parseInt(hex[2] + hex[2], 16),
		};
	}
	return {
		red: parseInt(hex.slice(0, 2), 16),
		green: parseInt(hex.slice(2, 4), 16),
		blue: parseInt(hex.slice(4, 6), 16),
	};
}

/** `true` when the hex background is dark enough for light (white) label text. */
export function isDarkHexColor(backgroundColor: string, threshold = DEFAULT_LUMINANCE_THRESHOLD): boolean {
	const rgb = parseHexColor(backgroundColor);
	if (!rgb) {
		return false;
	}
	return relativeLuminance(rgb.red, rgb.green, rgb.blue) < threshold;
}

/** Returns `#ffffff` or `#111827` (overridable) for readable pill labels. */
export function contrastTextColorForBackground(backgroundColor: string, options?: ContrastTextOptions): string {
	const threshold = options?.threshold ?? DEFAULT_LUMINANCE_THRESHOLD;
	const lightText = options?.lightText ?? DEFAULT_LIGHT_TEXT;
	const darkText = options?.darkText ?? DEFAULT_DARK_TEXT;
	return isDarkHexColor(backgroundColor, threshold) ? lightText : darkText;
}

/** Inline style for a solid-color pill: background + contrasting text color. */
export function coloredPillStyle(backgroundColor: string, options?: ContrastTextOptions): { backgroundColor: string; color: string } {
	return {
		backgroundColor,
		color: contrastTextColorForBackground(backgroundColor, options),
	};
}

/**
 * Soft tint of `backgroundColor` over a *light* surface — the pill stays
 * recognisable but only ~18% of the chip is the source colour, the rest is
 * blended toward the brand canvas. Used wherever many distinct chips appear
 * together (grade tiles, attribute swatches, offer rows) so the layout reads
 * as a harmonious palette instead of a vivid rainbow.
 *
 * Returns a small inline-style record (background + text + border tint).
 */
export function softColoredPillStyleOnLight(backgroundColor: string): {
	backgroundColor: string;
	color: string;
	borderColor: string;
} {
	return {
		backgroundColor: `color-mix(in srgb, ${backgroundColor} 18%, #ffffff)`,
		color: `color-mix(in srgb, ${backgroundColor} 65%, #00272c)`,
		borderColor: `color-mix(in srgb, ${backgroundColor} 32%, transparent)`,
	};
}

/**
 * Soft tint of `backgroundColor` for *dark* surfaces (the home grades band,
 * inverted hero callouts). Same idea, mirrored: the chip background is the
 * brand ink with a light hue wash, and the text is a brightened version of
 * the source colour so it still pops on `--color-ink-900`.
 */
export function softColoredPillStyleOnDark(backgroundColor: string): {
	backgroundColor: string;
	color: string;
	borderColor: string;
} {
	return {
		backgroundColor: `color-mix(in srgb, ${backgroundColor} 22%, #00272c)`,
		color: `color-mix(in srgb, ${backgroundColor} 65%, #ffffff)`,
		borderColor: `color-mix(in srgb, ${backgroundColor} 40%, transparent)`,
	};
}
