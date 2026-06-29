"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Triggers a one-shot CSS animation when `key` changes (e.g. shop URL filters).
 * Skips the first render so initial page load stays instant.
 */
export function useSwapAnimation(key: string): boolean {
	const [isSwapping, setIsSwapping] = useState(false);
	const hasMounted = useRef(false);
	const previousKey = useRef(key);

	useEffect(() => {
		if (!hasMounted.current) {
			hasMounted.current = true;
			previousKey.current = key;
			return;
		}

		if (previousKey.current === key) {
			return;
		}

		previousKey.current = key;
		setIsSwapping(true);
		const timeout = window.setTimeout(() => setIsSwapping(false), 460);
		return () => window.clearTimeout(timeout);
	}, [key]);

	return isSwapping;
}
