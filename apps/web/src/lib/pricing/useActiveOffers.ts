"use client";

import { useSyncExternalStore } from "react";
import type { ActiveOffer } from "@store/shared";

/**
 * Offers power every price line (cart, drawer, PDP). A module-level cache +
 * revision polling collapses duplicate fetches and busts stale data after
 * admin publishes offer changes.
 *
 * One global poll interval serves every `useActiveOffers()` subscriber — each
 * product card must not register its own timer.
 */
const OFFERS_TTL_MS = 30_000;
const REVISION_POLL_MS = 20_000;

let cachedOffers: ActiveOffer[] | null = null;
let cachedAt = 0;
let cachedRevision = "";
let inflight: Promise<ActiveOffer[]> | null = null;

type OffersSnapshot = { offers: ActiveOffer[]; isLoading: boolean };

let snapshot: OffersSnapshot = {
	offers: cachedOffers ?? [],
	isLoading: cachedOffers === null,
};

const serverSnapshot: OffersSnapshot = { offers: [], isLoading: true };

const listeners = new Set<() => void>();
let revisionTimer: number | null = null;
let focusListenerAttached = false;
let subscriberCount = 0;

function publishSnapshot(next: OffersSnapshot): void {
	snapshot = next;
	for (const listener of listeners) {
		listener();
	}
}

function getSnapshot(): OffersSnapshot {
	return snapshot;
}

function getServerSnapshot(): OffersSnapshot {
	return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	subscriberCount += 1;
	if (subscriberCount === 1) {
		startGlobalSync();
	}
	return () => {
		listeners.delete(listener);
		subscriberCount -= 1;
		if (subscriberCount === 0) {
			stopGlobalSync();
		}
	};
}

function invalidateOffersCache(): void {
	cachedAt = 0;
}

async function fetchOffersRevision(): Promise<string> {
	try {
		const response = await fetch("/api/offers/revision", { cache: "no-store" });
		if (!response.ok) {
			return cachedRevision;
		}
		const data = (await response.json()) as { revision?: string };
		return typeof data.revision === "string" ? data.revision : "";
	} catch {
		return cachedRevision;
	}
}

async function syncOffersRevision(): Promise<boolean> {
	const revision = await fetchOffersRevision();
	if (!revision) {
		return false;
	}
	const changed = Boolean(cachedRevision && revision !== cachedRevision);
	cachedRevision = revision;
	return changed;
}

async function loadOffers(): Promise<ActiveOffer[]> {
	const isFresh = cachedOffers !== null && Date.now() - cachedAt < OFFERS_TTL_MS;
	if (isFresh) {
		return cachedOffers as ActiveOffer[];
	}
	if (inflight) {
		return inflight;
	}
	inflight = (async () => {
		try {
			await syncOffersRevision();
			const response = await fetch("/api/offers", { cache: "no-store" });
			if (!response.ok) {
				return cachedOffers ?? [];
			}
			const data = (await response.json()) as ActiveOffer[];
			cachedOffers = data;
			cachedAt = Date.now();
			return data;
		} catch {
			return cachedOffers ?? [];
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

async function refreshOffers(): Promise<void> {
	publishSnapshot({ offers: cachedOffers ?? [], isLoading: cachedOffers === null });
	const next = await loadOffers();
	publishSnapshot({ offers: next, isLoading: false });
}

function onWindowFocus(): void {
	void syncOffersRevision().then(() => {
		invalidateOffersCache();
		void refreshOffers();
	});
}

function checkRevisionAndRefresh(): void {
	void syncOffersRevision().then((changed) => {
		if (changed) {
			invalidateOffersCache();
			void refreshOffers();
		}
	});
}

function startGlobalSync(): void {
	void refreshOffers();
	revisionTimer = window.setInterval(checkRevisionAndRefresh, REVISION_POLL_MS);
	if (!focusListenerAttached) {
		window.addEventListener("focus", onWindowFocus);
		focusListenerAttached = true;
	}
}

function stopGlobalSync(): void {
	if (revisionTimer) {
		window.clearInterval(revisionTimer);
		revisionTimer = null;
	}
	if (focusListenerAttached) {
		window.removeEventListener("focus", onWindowFocus);
		focusListenerAttached = false;
	}
}

export function useActiveOffers(): OffersSnapshot {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
