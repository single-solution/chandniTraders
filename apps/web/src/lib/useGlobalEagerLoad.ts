"use client";

import { useEffect, useState } from "react";

let globalEagerLoad = false;
let listeners: Set<() => void> = new Set();

function setGlobalEagerLoad() {
	if (globalEagerLoad) return;
	globalEagerLoad = true;
	listeners.forEach((listener) => listener());
	listeners.clear();
}

if (typeof window !== "undefined") {
	// Wait until the page has fully loaded (all initial resources finished)
	// Then wait an extra 1.5 seconds to ensure the main thread is idle
	// before we trigger the avalanche of eager image requests.
	const trigger = () => {
		if (typeof window.requestIdleCallback === "function") {
			window.requestIdleCallback(setGlobalEagerLoad, { timeout: 2000 });
		} else {
			setTimeout(setGlobalEagerLoad, 1500);
		}
	};

	if (document.readyState === "complete") {
		trigger();
	} else {
		window.addEventListener("load", trigger);
	}
}

/**
 * Returns false initially so images use native lazy loading.
 * After the window "load" event + idle time, returns true so images
 * switch to eager loading and fetch in the background before the user scrolls.
 */
export function useGlobalEagerLoad() {
	const [eager, setEager] = useState(globalEagerLoad);

	useEffect(() => {
		if (globalEagerLoad) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- required for safe hydration
			setEager(true);
			return;
		}
		const listener = () => setEager(true);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	return eager;
}
