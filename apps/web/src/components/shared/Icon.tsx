import { createElement } from "react";
import type { CSSProperties } from "react";

import { classNames } from "@store/shared";

import type { IconNode } from "@/lib/icons/types";

interface IconProps {
	/** Serializable lucide geometry from `resolveIconNode`. */
	node: IconNode;
	size?: number;
	strokeWidth?: number;
	className?: string;
	style?: CSSProperties;
}

/**
 * Registry-free lucide renderer.
 *
 * Draws the SVG from a pre-resolved `iconNode` using lucide's exact default
 * attributes, so output is pixel-identical to `lucide-react` without
 * importing any icon code. Pure and presentational — safe in both server
 * and client component trees. Always decorative (`aria-hidden`); callers
 * provide their own accessible label.
 */
export function Icon({ node, size = 24, strokeWidth = 2, className, style }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={classNames("lucide", className)}
			style={style}
			aria-hidden="true"
		>
			{node.map(([tag, attrs], index) =>
				createElement(tag, {
					...attrs,
					key: typeof attrs.key === "string" ? attrs.key : index,
				}),
			)}
		</svg>
	);
}
