"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { reconcileCartWithCatalog, subscribeCartReconciliation, getCartReconciliationSnapshot } from "@/lib/cart/cartReconciliation";
import { useCart } from "@/lib/cart/useCart";
import { useToast } from "@/components/ui/Toast";

function cartItemsSignature(items: { id: string; variantId: string; quantity: number }[]): string {
	return items.map((line) => `${line.id}:${line.variantId}:${line.quantity}`).join("|");
}

/**
 * Keeps localStorage cart aligned with live catalog (variant IDs, prices, stock caps).
 * Safe to mount in multiple surfaces — reconciliation requests are deduped.
 */
export function useCartReconciliation(options?: { enabled?: boolean }) {
	const enabled = options?.enabled ?? true;
	const cart = useCart();
	const { toast } = useToast();
	const isReconciling = useSyncExternalStore(subscribeCartReconciliation, getCartReconciliationSnapshot, () => false);
	const lastSignatureRef = useRef("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const runReconcile = useCallback(() => {
		void reconcileCartWithCatalog((message, toastOptions) => {
			toast(message, toastOptions);
		});
	}, [toast]);

	useEffect(() => {
		if (!enabled || cart.isEmpty) {
			return;
		}

		const signature = cartItemsSignature(cart.items);
		if (signature === lastSignatureRef.current) {
			return;
		}
		lastSignatureRef.current = signature;

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			runReconcile();
		}, 200);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [cart.isEmpty, cart.items, enabled, runReconcile]);

	const ensureReconciled = useCallback(async (): Promise<boolean> => {
		if (cart.isEmpty) {
			return true;
		}
		return reconcileCartWithCatalog((message, toastOptions) => {
			toast(message, toastOptions);
		});
	}, [cart.isEmpty, toast]);

	return { isReconciling, ensureReconciled };
}

/** Read-only reconciliation state + manual refresh (checkout place-order). */
export function useCartReconciliationControls() {
	const { toast } = useToast();
	const isReconciling = useSyncExternalStore(subscribeCartReconciliation, getCartReconciliationSnapshot, () => false);

	const ensureReconciled = useCallback(async (): Promise<boolean> => {
		return reconcileCartWithCatalog((message, toastOptions) => {
			toast(message, toastOptions);
		});
	}, [toast]);

	return { isReconciling, ensureReconciled };
}

/** Invisible runner for app shell — one global reconciliation subscription. */
export function CartReconciliationRunner() {
	useCartReconciliation();
	return null;
}
