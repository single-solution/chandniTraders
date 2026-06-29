"use client";

import { useEffect } from "react";

import { clearChatPageContext, setChatPageContext } from "@/lib/chat/pageChatContext";

/**
 * Publishes the current product as the page chat context so the launcher can
 * show a product-aware nudge and the opener can reference it. Clears on unmount
 * (navigation away), so stale product context never leaks to the next page.
 */
export function ProductChatBeacon({ productId, productName }: { productId: string; productName: string }) {
	useEffect(() => {
		setChatPageContext({ kind: "product", productId, productName });
		return () => clearChatPageContext();
	}, [productId, productName]);

	return null;
}
