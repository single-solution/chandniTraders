import { formatPrice } from "@store/shared";

import { getCartSnapshot, remapCartLine, removeCartItem } from "@/lib/cart/store";
import type { CartItem } from "@/lib/cart/types";

export interface CartReconcileResponseLine {
	id: string;
	status: "ok" | "remapped" | "unavailable";
	variantId?: string;
	unitPriceRupees?: number;
	maxQuantity?: number;
	productName?: string;
	message?: string;
}

type ReconcileListener = () => void;

let activeReconcile: Promise<boolean> | null = null;
let isReconciling = false;
const reconcileListeners = new Set<ReconcileListener>();

function setReconciling(next: boolean) {
	isReconciling = next;
	for (const listener of reconcileListeners) {
		listener();
	}
}

export function subscribeCartReconciliation(listener: ReconcileListener): () => void {
	reconcileListeners.add(listener);
	return () => {
		reconcileListeners.delete(listener);
	};
}

export function getCartReconciliationSnapshot(): boolean {
	return isReconciling;
}

function toReconcilePayload(items: CartItem[]) {
	return items.map((line) => ({
		id: line.id,
		productId: line.productId,
		variantId: line.variantId,
		attributes: line.attributes ?? {},
	}));
}

function applyReconcileResults(
	lines: CartReconcileResponseLine[],
	toast?: (message: string, options?: { tone?: "info" | "success" }) => void,
) {
	for (const result of lines) {
		if (result.status === "unavailable") {
			removeCartItem(result.id);
			toast?.(result.message ?? `${result.productName ?? "An item"} was removed from your cart.`, { tone: "info" });
			continue;
		}

		if (!result.variantId || typeof result.unitPriceRupees !== "number") {
			continue;
		}

		const currentLine = getCartSnapshot().items.find((line) => line.id === result.id);
		if (!currentLine) {
			continue;
		}

		const priceChanged = currentLine.unitPriceRupees !== result.unitPriceRupees;
		const stockCapChanged = typeof result.maxQuantity === "number" && currentLine.maxQuantity !== result.maxQuantity;
		const idChanged = currentLine.variantId !== result.variantId;

		if (idChanged) {
			remapCartLine(result.id, {
				variantId: result.variantId,
				unitPriceRupees: result.unitPriceRupees,
				maxQuantity: result.maxQuantity,
			});
			if (result.message) {
				toast?.(result.message, { tone: "info" });
			}
			continue;
		}

		if (priceChanged || stockCapChanged) {
			remapCartLine(result.id, {
				variantId: result.variantId,
				unitPriceRupees: result.unitPriceRupees,
				maxQuantity: result.maxQuantity,
			});
			if (priceChanged) {
				toast?.(
					`${result.productName ?? currentLine.productName} is now ${formatPrice(result.unitPriceRupees)} in your cart.`,
					{ tone: "info" },
				);
			}
		}
	}
}

async function fetchReconcile(items: CartItem[]): Promise<CartReconcileResponseLine[]> {
	if (items.length === 0) {
		return [];
	}

	const response = await fetch("/api/cart/reconcile", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ items: toReconcilePayload(items) }),
	});

	if (!response.ok) {
		throw new Error("Cart could not be refreshed.");
	}

	const data = (await response.json()) as { lines?: CartReconcileResponseLine[] };
	return data.lines ?? [];
}

/**
 * Sync cart lines with live catalog (deduped — concurrent callers share one request).
 * @returns `true` when reconciliation succeeded; `false` on network/API failure.
 */
export async function reconcileCartWithCatalog(
	toast?: (message: string, options?: { tone?: "info" | "success" }) => void,
): Promise<boolean> {
	if (activeReconcile) {
		return activeReconcile;
	}

	const items = getCartSnapshot().items;
	if (items.length === 0) {
		return true;
	}

	activeReconcile = (async () => {
		setReconciling(true);
		try {
			const lines = await fetchReconcile(items);
			applyReconcileResults(lines, toast);
			return true;
		} catch {
			toast?.("Could not refresh your cart. Try again before checkout.", { tone: "info" });
			return false;
		} finally {
			setReconciling(false);
			activeReconcile = null;
		}
	})();

	return activeReconcile;
}
