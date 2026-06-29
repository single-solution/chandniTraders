import type { HTMLAttributes } from "react";
import { classNames } from "@store/shared";

/**
 * Shimmer placeholder block. Drives every `loading.tsx` skeleton in the
 * storefront — keeping the look in one place means a future motion or token
 * tweak only happens here.
 *
 * The visual style itself lives in `globals.css` (`.skeleton`) so the same
 * shimmer is available to any non-React surface that needs it.
 */
type SkeletonShape = "block" | "circle" | "pill" | "text";

interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
	shape?: SkeletonShape;
}

const SHAPE_CLASS: Record<SkeletonShape, string> = {
	block: "rounded-[var(--radius-md)]",
	circle: "rounded-full",
	pill: "rounded-[var(--radius-full)]",
	text: "rounded-[var(--radius-sm)]",
};

export function Skeleton({ shape = "block", className, "aria-hidden": ariaHidden = true, ...rest }: SkeletonProps) {
	return <span {...rest} aria-hidden={ariaHidden} className={classNames("skeleton block", SHAPE_CLASS[shape], className)} />;
}

/**
 * Wrapper that announces a loading region to assistive tech. Use once around
 * each skeleton screen — individual `Skeleton` blocks inside stay aria-hidden.
 */
interface SkeletonScreenProps extends HTMLAttributes<HTMLDivElement> {
	label?: string;
}

export function SkeletonScreen({ label = "Loading", className, children, ...rest }: SkeletonScreenProps) {
	return (
		<div {...rest} role="status" aria-live="polite" aria-busy className={className}>
			<span className="sr-only">{label}…</span>
			{children}
		</div>
	);
}
