"use client";

/**
 * Browser-local cart store.
 *
 * Single source of truth, persisted to `localStorage`, exposed through a
 * `useSyncExternalStore` subscription so any cart-aware component re-renders
 * when the cart changes. Cross-tab updates are picked up via the `storage`
 * event so the count badge stays in sync if the customer adds something in
 * another tab.
 *
 * Server-side fallback: when no DOM is present we return an empty snapshot
 * so server components can read the cart shape without exploding.
 */

import type { CartItem } from "@/lib/cart/types";

const STORAGE_KEY = "storefront:cart:v1";
const MAX_QUANTITY = 10;
const MAX_LINES = 20;

type Listener = () => void;

interface CartState {
	items: CartItem[];
}

const EMPTY_STATE: CartState = { items: [] };

let cachedState: CartState = EMPTY_STATE;
let isHydrated = false;
const listeners = new Set<Listener>();

function isBrowser(): boolean {
	return typeof window !== "undefined";
}

function normalizeCartLine(line: CartItem): CartItem {
	if (line.appliedOffer?.id) {
		return line;
	}
	if (typeof line.appliedOfferId === "string" && line.appliedOfferId.length > 0) {
		return {
			...line,
			appliedOffer: {
				id: line.appliedOfferId,
				title: "Deal",
				lockedAt: new Date().toISOString(),
			},
		};
	}
	return line;
}

function readPersisted(): CartState {
	if (!isBrowser()) {
		return EMPTY_STATE;
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return EMPTY_STATE;
		}
		const parsed = JSON.parse(raw) as Partial<CartState> | null;
		if (!parsed || !Array.isArray(parsed.items)) {
			return EMPTY_STATE;
		}
		// Defensive: drop any malformed lines so a corrupted localStorage entry
		// doesn't poison every render.
		const items = parsed.items
			.filter(
				(candidate): candidate is CartItem =>
					candidate !== null &&
					typeof candidate === "object" &&
					typeof (candidate as CartItem).id === "string" &&
					typeof (candidate as CartItem).productId === "string" &&
					typeof (candidate as CartItem).variantId === "string" &&
					typeof (candidate as CartItem).quantity === "number" &&
					typeof (candidate as CartItem).productName === "string" &&
					typeof (candidate as CartItem).unitPriceRupees === "number",
			)
			.slice(0, MAX_LINES)
			.map((line) => normalizeCartLine(line));
		return { items };
	} catch {
		// Corrupt JSON in localStorage — discard and start fresh.
		return EMPTY_STATE;
	}
}

function persist(state: CartState) {
	if (!isBrowser()) {
		return;
	}
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignore quota-exceeded; in-memory state still wins.
	}
}

function hydrateOnce() {
	if (isHydrated || !isBrowser()) {
		return;
	}
	cachedState = readPersisted();
	isHydrated = true;
	// Cross-tab sync — when another tab updates the cart key, refresh ours.
	window.addEventListener("storage", (event) => {
		if (event.key !== STORAGE_KEY) {
			return;
		}
		cachedState = readPersisted();
		notify();
	});
}

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

function setState(next: CartState) {
	cachedState = next;
	persist(next);
	notify();
}

/** Current cart state for the browser tab. Hydrates from localStorage on first call. */
export function getCartSnapshot(): CartState {
	hydrateOnce();
	return cachedState;
}

/** Server snapshot — always empty so SSR pre-render matches the unhydrated client. */
export function getCartServerSnapshot(): CartState {
	return EMPTY_STATE;
}

/** Subscribe to cart mutations; returns an unsubscribe function. */
export function subscribeToCart(listener: Listener): () => void {
	listeners.add(listener);
	hydrateOnce();
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Add a line to the cart, merging onto an existing variant if present.
 * Returns `false` when the cart already holds `MAX_LINES` distinct lines so
 * the caller can surface feedback (toast) instead of the add being a silent
 * no-op. Merging onto an existing line always succeeds.
 */
export function addCartItem(item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }): boolean {
	hydrateOnce();
	const id = `${item.productId}:${item.variantId}`;
	const maxQuantity = item.maxQuantity;
	const quantityToAdd = clampLineQuantity(item.quantity ?? 1, maxQuantity);

	const existingIndex = cachedState.items.findIndex((line) => line.id === id);
	let nextItems: CartItem[];
	if (existingIndex >= 0) {
		nextItems = cachedState.items.map((line, index) => {
			if (index !== existingIndex) {
				return line;
			}
			const lineMax = maxQuantity ?? line.maxQuantity;
			return {
				...line,
				maxQuantity: lineMax,
				quantity: clampLineQuantity(line.quantity + quantityToAdd, lineMax),
				...(item.appliedOffer ? { appliedOffer: item.appliedOffer } : {}),
			};
		});
	} else {
		if (cachedState.items.length >= MAX_LINES) {
			return false;
		}
		nextItems = [...cachedState.items, { ...item, id, quantity: quantityToAdd, maxQuantity }];
	}
	setState({ items: nextItems });
	return true;
}

/** Max distinct cart lines — exported so the UI can message the cap. */
export const CART_MAX_LINES = MAX_LINES;

/** Drop a line by its compound `productId:variantId` cart ID. */
export function removeCartItem(id: string) {
	hydrateOnce();
	setState({ items: cachedState.items.filter((line) => line.id !== id) });
}

export interface CartLineRemapPatch {
	variantId: string;
	unitPriceRupees: number;
	maxQuantity?: number;
}

/**
 * Point a cart line at a new catalog variant (same product, new `_id`).
 * Merges into an existing line when the target variant is already in the cart.
 */
export function remapCartLine(lineId: string, patch: CartLineRemapPatch) {
	hydrateOnce();
	const sourceLine = cachedState.items.find((line) => line.id === lineId);
	if (!sourceLine) {
		return;
	}

	const nextId = `${sourceLine.productId}:${patch.variantId}`;
	const targetIndex = cachedState.items.findIndex((line) => line.id === nextId);
	let nextItems: CartItem[];

	if (targetIndex >= 0 && cachedState.items[targetIndex]?.id !== lineId) {
		const targetLine = cachedState.items[targetIndex];
		if (!targetLine) {
			return;
		}
		const targetMax = patch.maxQuantity ?? targetLine.maxQuantity;
		const mergedTarget: CartItem = {
			...targetLine,
			unitPriceRupees: patch.unitPriceRupees,
			maxQuantity: targetMax,
			quantity: clampLineQuantity(targetLine.quantity + sourceLine.quantity, targetMax),
		};
		nextItems = cachedState.items.filter((line) => line.id !== lineId).map((line) => (line.id === targetLine.id ? mergedTarget : line));
	} else {
		nextItems = cachedState.items.map((line) => {
			if (line.id !== lineId) {
				return line;
			}
			const lineMax = patch.maxQuantity ?? line.maxQuantity;
			return {
				...line,
				id: nextId,
				variantId: patch.variantId,
				unitPriceRupees: patch.unitPriceRupees,
				maxQuantity: lineMax,
				quantity: clampLineQuantity(line.quantity, lineMax),
			};
		});
	}

	setState({ items: nextItems });
}

/** Set a line's quantity; passing `0` (or any non-finite value) removes the line. */
export function updateCartItemQuantity(id: string, quantity: number) {
	hydrateOnce();
	const line = cachedState.items.find((entry) => entry.id === id);
	const clamped = clampLineQuantity(quantity, line?.maxQuantity);
	if (clamped === 0) {
		removeCartItem(id);
		return;
	}
	setState({
		items: cachedState.items.map((entry) => (entry.id === id ? { ...entry, quantity: clamped } : entry)),
	});
}

/** Empty the cart entirely. */
export function clearCart() {
	setState({ items: [] });
}

function clampLineQuantity(quantity: number, maxQuantity?: number): number {
	if (!Number.isFinite(quantity) || quantity < 0) {
		return 0;
	}
	const cap = typeof maxQuantity === "number" && maxQuantity > 0 ? maxQuantity : MAX_QUANTITY;
	return Math.min(cap, Math.floor(quantity));
}
