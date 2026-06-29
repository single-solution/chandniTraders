"use client";

import { useEffect, type RefObject } from "react";

/** Selector for elements that can receive keyboard focus inside an overlay. */
const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null || element === document.activeElement);
}

/**
 * Traps Tab focus inside `containerRef` while `active`, then restores focus
 * to whatever was focused before the overlay opened. Keeps keyboard users
 * inside modal surfaces (dialogs, sheets, flyouts) instead of tabbing into
 * the inert page behind them.
 *
 * Pass `active` = the overlay's real open flag (not a presence/closing flag)
 * so focus is released the instant a close is requested.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
	useEffect(() => {
		if (!active) {
			return;
		}
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const previouslyFocused = document.activeElement as HTMLElement | null;

		// Move focus into the overlay if it isn't already there.
		if (!container.contains(document.activeElement)) {
			const [first] = getFocusable(container);
			(first ?? container).focus();
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Tab") {
				return;
			}
			const node = containerRef.current;
			if (!node) {
				return;
			}
			const focusable = getFocusable(node);
			if (focusable.length === 0) {
				event.preventDefault();
				node.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const activeElement = document.activeElement as HTMLElement | null;

			if (event.shiftKey && (activeElement === first || !node.contains(activeElement))) {
				event.preventDefault();
				last.focus();
				return;
			}
			if (!event.shiftKey && activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		container.addEventListener("keydown", handleKeyDown);
		return () => {
			container.removeEventListener("keydown", handleKeyDown);
			// Restore focus only if it's still inside the (closing) overlay, so we
			// don't yank focus away from wherever the user has since clicked.
			if (previouslyFocused && container.contains(document.activeElement)) {
				previouslyFocused.focus({ preventScroll: true });
			}
		};
	}, [active, containerRef]);
}
