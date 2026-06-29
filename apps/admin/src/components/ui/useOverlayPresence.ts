"use client";

import { useEffect, useRef, useState } from "react";

/** Time the exit animation is allowed to run before the overlay unmounts. */
const DEFAULT_EXIT_MS = 220;

interface OverlayPresence {
	/** Keep the overlay in the DOM (true through the exit animation). */
	isMounted: boolean;
	/** Apply the exit animation classes this frame. */
	isClosing: boolean;
}

/**
 * Keeps an overlay mounted for one exit animation after `isOpen` flips false,
 * so Drawer / Flyout / ConfirmDialog slide or fade out instead of vanishing.
 * Honours `prefers-reduced-motion` by unmounting immediately.
 */
export function useOverlayPresence(isOpen: boolean, exitMs: number = DEFAULT_EXIT_MS): OverlayPresence {
	const exitTimer = useRef<number | null>(null);
	const [isMounted, setIsMounted] = useState(isOpen);
	const [isClosing, setIsClosing] = useState(false);

	useEffect(() => {
		if (isOpen) {
			if (exitTimer.current !== null) {
				window.clearTimeout(exitTimer.current);
				exitTimer.current = null;
			}
			// eslint-disable-next-line react-hooks/set-state-in-effect -- open/close driven
			setIsClosing(false);
			setIsMounted(true);
			return;
		}

		if (!isMounted) {
			return;
		}

		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReducedMotion) {
			setIsMounted(false);
			return;
		}

		setIsClosing(true);
		exitTimer.current = window.setTimeout(() => {
			setIsMounted(false);
			setIsClosing(false);
			exitTimer.current = null;
		}, exitMs);
	}, [isOpen, isMounted, exitMs]);

	useEffect(() => {
		return () => {
			if (exitTimer.current !== null) {
				window.clearTimeout(exitTimer.current);
			}
		};
	}, []);

	return { isMounted, isClosing };
}
