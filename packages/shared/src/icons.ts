export type IconName = string;

/**
 * Serializable lucide icon geometry — an array of `[svgChildTag,
 * attributes]` pairs (lucide's `__iconNode`). Resolved on the server and
 * shipped with content so clients render icons with no registry code.
 */
export type IconNodeChild = [string, Record<string, string | number>];
export type IconNode = IconNodeChild[];

export const DEFAULT_ICON: IconName = "Package";

const ICON_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export function normalizeIconName(value: unknown, fallback: IconName = DEFAULT_ICON): IconName {
	if (typeof value !== "string") {
		return fallback;
	}
	const trimmed = value.trim();
	if (!ICON_NAME_PATTERN.test(trimmed)) {
		return fallback;
	}
	return trimmed;
}
