export type FloatingAlign = "left" | "right" | "center";

export interface FloatingPositionInput {
	anchorRect: DOMRect;
	panelWidth: number;
	panelHeight: number;
	align?: FloatingAlign;
	gap?: number;
	viewportPadding?: number;
	viewportWidth?: number;
	viewportHeight?: number;
}

export interface FloatingPositionResult {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
	maxHeight?: number;
	maxWidth?: number;
	placement: "above" | "below";
}

const DEFAULT_GAP = 6;
const DEFAULT_VIEWPORT_PADDING = 8;

/** Chooses fixed coordinates for a floating panel anchored to a trigger rect. */
export function computeFloatingPosition({
	anchorRect,
	panelWidth,
	panelHeight,
	align = "left",
	gap = DEFAULT_GAP,
	viewportPadding = DEFAULT_VIEWPORT_PADDING,
	viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0,
	viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0,
}: FloatingPositionInput): FloatingPositionResult {
	const spaceBelow = viewportHeight - anchorRect.bottom - viewportPadding;
	const spaceAbove = anchorRect.top - viewportPadding;
	const maxViewportHeight = viewportHeight - viewportPadding * 2;
	const availableWidth = viewportWidth - viewportPadding * 2;

	const openBelow = spaceBelow >= spaceAbove;
	const placement = openBelow ? "below" : "above";

	let top: number | undefined;
	let bottom: number | undefined;
	let maxHeight: number | undefined;

	if (openBelow) {
		top = anchorRect.bottom + gap;
		maxHeight = Math.max(0, Math.min(spaceBelow - gap, maxViewportHeight));
	} else {
		bottom = viewportHeight - anchorRect.top + gap;
		maxHeight = Math.max(0, Math.min(spaceAbove - gap, maxViewportHeight));
	}

	let left: number | undefined;
	let right: number | undefined;
	let maxWidth: number | undefined;

	if (panelWidth > availableWidth) {
		maxWidth = availableWidth;
		left = viewportPadding;
	} else if (align === "right") {
		right = viewportWidth - anchorRect.right;
		const panelLeft = anchorRect.right - panelWidth;
		if (panelLeft < viewportPadding) {
			left = Math.max(viewportPadding, anchorRect.left);
			right = undefined;
			if (left + panelWidth > viewportWidth - viewportPadding) {
				left = viewportWidth - viewportPadding - panelWidth;
			}
		}
	} else if (align === "center") {
		left = anchorRect.left + anchorRect.width / 2 - panelWidth / 2;
		if (left + panelWidth > viewportWidth - viewportPadding) {
			left = viewportWidth - viewportPadding - panelWidth;
		}
		left = Math.max(viewportPadding, left);
	} else {
		left = anchorRect.left;
		if (left + panelWidth > viewportWidth - viewportPadding) {
			left = viewportWidth - viewportPadding - panelWidth;
		}
		left = Math.max(viewportPadding, left);
	}

	return {
		top,
		bottom,
		left,
		right,
		maxHeight: maxHeight > 0 ? maxHeight : undefined,
		maxWidth,
		placement,
	};
}
