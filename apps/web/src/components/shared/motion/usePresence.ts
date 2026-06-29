"use client";

import { useEffect, useState } from "react";

export type PresenceStatus = "open" | "closing";

interface PresenceState {
	/** Whether the overlay should be in the DOM (true while open AND while
	 *  the exit animation is still playing). */
	isMounted: boolean;
	/** "open" while entering/idle, "closing" while the exit animation runs. */
	status: PresenceStatus;
}

/**
 * Keeps a closing overlay mounted long enough to play its exit animation,
 * then unmounts it — giving overlays symmetric, interruptible enter/exit
 * without pulling in an animation library.
 *
 * Re-opening mid-exit cancels the pending unmount (interruptible), so a
 * fast toggle never strands the overlay in a half-closed state.
 *
 * `exitDurationMs` must match the CSS exit animation duration so the node
 * is removed exactly as the animation lands.
 */
export function usePresence(isOpen: boolean, exitDurationMs: number): PresenceState {
	const [isMounted, setIsMounted] = useState(isOpen);
	const [status, setStatus] = useState<PresenceStatus>(isOpen ? "open" : "closing");

	if (isOpen) {
		if (!isMounted) {
			setIsMounted(true);
		}
		if (status !== "open") {
			setStatus("open");
		}
	} else if (status === "open") {
		setStatus("closing");
	}

	useEffect(() => {
		if (isOpen) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setIsMounted(false);
		}, exitDurationMs);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [isOpen, exitDurationMs]);

	return { isMounted, status };
}
