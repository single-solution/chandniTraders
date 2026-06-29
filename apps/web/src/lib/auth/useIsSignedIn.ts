"use client";

import { useEffect, useState } from "react";

/** Shared across mounts so navigating doesn't refetch the session each time. */
let cachedSignedIn: boolean | null = null;
const subscribers = new Set<(value: boolean | null) => void>();

function emit(value: boolean | null): void {
	cachedSignedIn = value;
	subscribers.forEach((notify) => notify(value));
}

async function fetchSignedIn(): Promise<boolean> {
	try {
		const response = await fetch("/api/auth/session", {
			headers: { accept: "application/json" },
			cache: "no-store",
		});
		if (!response.ok) {
			return false;
		}
		const data = (await response.json()) as { user?: unknown } | null;
		return Boolean(data?.user);
	} catch {
		return false;
	}
}

/** Re-check the session and broadcast the result to every mounted hook. */
export function refreshSignedIn(): void {
	void fetchSignedIn().then(emit);
}

/**
 * Optimistically set the flag without a round-trip — call right after a
 * successful sign-in / sign-out so storefront chrome updates immediately
 * instead of waiting for the next focus event or full reload.
 */
export function setSignedIn(value: boolean): void {
	emit(value);
}

/**
 * Client-only signed-in flag for storefront chrome (header account link).
 * Returns `null` until the first check resolves so the server / initial render
 * stays neutral and there's no hydration mismatch. Refreshes on tab focus to
 * pick up sign-in / sign-out that happened elsewhere.
 */
export function useIsSignedIn(): boolean | null {
	const [signedIn, setSignedInState] = useState<boolean | null>(cachedSignedIn);

	useEffect(() => {
		subscribers.add(setSignedInState);

		if (cachedSignedIn === null) {
			refreshSignedIn();
		}

		const refresh = () => refreshSignedIn();
		window.addEventListener("focus", refresh);
		return () => {
			subscribers.delete(setSignedInState);
			window.removeEventListener("focus", refresh);
		};
	}, []);

	return signedIn;
}
