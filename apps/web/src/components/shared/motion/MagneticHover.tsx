"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Magnetic hover — wraps a CTA (button, link, anything) so that as the
 * pointer enters the element's "field" it subtly attracts the child
 * toward the cursor.
 *
 *   • Lerps to the target each animation frame so motion is smooth no
 *     matter how fast the cursor moves.
 *   • Translation is capped to a fraction of element size — magnetism
 *     should feel like a hint, not a leap.
 *   • Disabled on coarse pointers and when the user prefers reduced
 *     motion.
 *   • Writes directly to inline transforms, never re-renders React.
 */
interface MagneticHoverProps {
	children: ReactNode;
	/** Strength of the attraction (0..1). 0.3 = cursor moves child by
	 *  ~30% of the offset from element center. */
	strength?: number;
	/** Max translation in px on each axis. Defaults to 10. */
	maxOffset?: number;
	/**
	 * Optional ancestor selector resolving the magnetic "field". When set,
	 * the child leans toward the pointer anywhere inside that ancestor
	 * (resolved via `closest`) instead of only while the pointer is over
	 * the child itself. The child still stays inside its own container —
	 * only its inner transform shifts toward the cursor (capped to
	 * `maxOffset`). Falls back to the child when the selector matches nothing.
	 */
	fieldSelector?: string;
	className?: string;
	style?: CSSProperties;
}

export function MagneticHover({ children, strength = 0.28, maxOffset = 10, fieldSelector, className = "", style }: MagneticHoverProps) {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		if (typeof window === "undefined") return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
			return;
		}

		// The element listening for pointer movement. Defaults to the child
		// itself; a `fieldSelector` widens it to an ancestor so the magnet
		// tracks the cursor across a whole region (e.g. the hero banner).
		const field: HTMLElement = (fieldSelector && node.closest<HTMLElement>(fieldSelector)) || node;

		// Cache rect — only refresh on enter / resize / scroll. The rect is
		// always the child's box, so attraction is measured from the child's
		// centre even when the field (listener) is a larger ancestor.
		let rect = node.getBoundingClientRect();
		const refreshRect = () => {
			rect = node.getBoundingClientRect();
		};

		const target = { x: 0, y: 0 };
		const current = { x: 0, y: 0 };
		let frame: number | null = null;
		let animating = false;

		const tick = () => {
			current.x += (target.x - current.x) * 0.18;
			current.y += (target.y - current.y) * 0.18;
			node.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;
			const settled = Math.abs(current.x - target.x) < 0.1 && Math.abs(current.y - target.y) < 0.1;
			if (settled && target.x === 0 && target.y === 0) {
				node.style.transform = "translate3d(0,0,0)";
				node.style.willChange = "auto";
				animating = false;
				frame = null;
				return;
			}
			frame = window.requestAnimationFrame(tick);
		};

		const ensureLoop = () => {
			if (animating) return;
			animating = true;
			node.style.willChange = "transform";
			frame = window.requestAnimationFrame(tick);
		};

		const handleEnter = () => {
			refreshRect();
		};

		const handleMove = (event: PointerEvent) => {
			const dx = event.clientX - (rect.left + rect.width / 2);
			const dy = event.clientY - (rect.top + rect.height / 2);
			target.x = Math.max(-maxOffset, Math.min(maxOffset, dx * strength));
			target.y = Math.max(-maxOffset, Math.min(maxOffset, dy * strength));
			ensureLoop();
		};

		const handleLeave = () => {
			target.x = 0;
			target.y = 0;
			ensureLoop();
		};

		field.addEventListener("pointerenter", handleEnter, { passive: true });
		field.addEventListener("pointermove", handleMove, { passive: true });
		field.addEventListener("pointerleave", handleLeave, { passive: true });
		window.addEventListener("resize", refreshRect, { passive: true });
		window.addEventListener("scroll", refreshRect, { passive: true });
		return () => {
			field.removeEventListener("pointerenter", handleEnter);
			field.removeEventListener("pointermove", handleMove);
			field.removeEventListener("pointerleave", handleLeave);
			window.removeEventListener("resize", refreshRect);
			window.removeEventListener("scroll", refreshRect);
			if (frame != null) {
				window.cancelAnimationFrame(frame);
			}
		};
	}, [maxOffset, strength, fieldSelector]);

	return (
		<div ref={ref} className={`magnetic-hover ${className}`.trim()} style={style}>
			{children}
		</div>
	);
}
