import type { CSSProperties, HTMLAttributes } from "react";

/**
 * Animated placeholder used in `loading.tsx` route fallbacks.
 *
 * A `Skeleton` is a styled `<div>` with a low-contrast pulse — drop it
 * wherever a real chunk of content will land, and Next.js streams it in
 * during the route segment's data fetch.
 *
 * Three shapes cover ~90% of cases:
 *   - default: rounded rectangle (cards, images, buttons)
 *   - "text":  narrower vertical stroke (headlines, lines of copy)
 *   - "pill":  full radius (chips, tags)
 *   - "circle": 1:1 circle (avatars, icons)
 */
type SkeletonShape = "default" | "text" | "pill" | "circle";

interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	shape?: SkeletonShape;
}

const SHAPE_CLASS: Record<SkeletonShape, string> = {
	default: "rounded-[10px]",
	text: "rounded-[6px]",
	pill: "rounded-full",
	circle: "rounded-full aspect-square",
};

export function Skeleton({ shape = "default", className, style, ...rest }: SkeletonProps) {
	const composed = `${SHAPE_CLASS[shape]} ${className ?? ""}`.trim();
	const composedStyle: CSSProperties = {
		backgroundColor: "var(--color-canvas-deep, rgba(0,0,0,0.06))",
		...style,
	};
	return <div aria-hidden data-skeleton className={`animate-pulse ${composed}`} style={composedStyle} {...rest} />;
}

interface SkeletonScreenProps {
	/** Accessible status label announced to screen readers. */
	label: string;
	children: React.ReactNode;
}

/**
 * Wraps a page-level skeleton with the `role="status"` + `aria-live`
 * scaffolding so assistive tech announces the loading state once,
 * without spamming on every pulse tick.
 */
export function SkeletonScreen({ label, children }: SkeletonScreenProps) {
	return (
		<div role="status" aria-live="polite" aria-busy="true">
			<span className="sr-only">{label}</span>
			{children}
		</div>
	);
}
