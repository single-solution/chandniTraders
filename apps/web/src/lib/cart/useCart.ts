"use client";

/**
 * React binding for the cart store.
 *
 * All cart-aware components should consume this hook rather than reading
 * `localStorage` directly — that way subscriptions are uniform and we get
 * the cross-tab sync wiring for free.
 */

import { useSyncExternalStore } from "react";
import { addCartItem, clearCart, getCartServerSnapshot, getCartSnapshot, removeCartItem, subscribeToCart, updateCartItemQuantity } from "@/lib/cart/store";
import type { CartItem } from "@/lib/cart/types";

interface UseCart {
	items: CartItem[];
	/** Distinct cart lines (products), not total unit quantity. */
	itemCount: number;
	subtotalRupees: number;
	isEmpty: boolean;
	addItem: typeof addCartItem;
	removeItem: typeof removeCartItem;
	updateQuantity: typeof updateCartItemQuantity;
	clear: typeof clearCart;
}

export function useCart(): UseCart {
	const state = useSyncExternalStore(subscribeToCart, getCartSnapshot, getCartServerSnapshot);
	const items = state.items;
	const itemCount = items.length;
	const subtotalRupees = items.reduce((sum, line) => sum + line.unitPriceRupees * line.quantity, 0);
	return {
		items,
		itemCount,
		subtotalRupees,
		isEmpty: items.length === 0,
		addItem: addCartItem,
		removeItem: removeCartItem,
		updateQuantity: updateCartItemQuantity,
		clear: clearCart,
	};
}
