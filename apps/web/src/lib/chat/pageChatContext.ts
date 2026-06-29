/**
 * Shared, client-side "what is the visitor looking at?" signal.
 *
 * One source of truth consumed by BOTH chat surfaces:
 *   - the proactive idle nudge (teaser bubble beside the closed launcher), and
 *   - the context-aware opener (seeds the composer / assistant subject when the
 *     widget is opened from a product page).
 *
 * Pages publish their context via `setChatPageContext` (see `ProductChatBeacon`)
 * and clear it on unmount. There is no React provider — a tiny event-backed
 * module store keeps this decoupled from the render tree and free of re-renders
 * for pages that don't care.
 */

const PAGE_CONTEXT_EVENT = "store:chat-page-context";

export type ChatPageContextKind = "product" | "category" | "deals" | "cart" | "other";

export interface ChatPageContext {
	kind: ChatPageContextKind;
	productId?: string;
	productName?: string;
	categoryLabel?: string;
}

let current: ChatPageContext = { kind: "other" };

export function setChatPageContext(context: ChatPageContext): void {
	current = context;
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(PAGE_CONTEXT_EVENT, { detail: context }));
	}
}

export function clearChatPageContext(): void {
	setChatPageContext({ kind: "other" });
}

export function getChatPageContext(): ChatPageContext {
	return current;
}

export function subscribeChatPageContext(listener: (context: ChatPageContext) => void): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}
	const handler = (event: Event) => listener((event as CustomEvent<ChatPageContext>).detail);
	window.addEventListener(PAGE_CONTEXT_EVENT, handler);
	return () => window.removeEventListener(PAGE_CONTEXT_EVENT, handler);
}

/** Stable identity for "is this a new thing to nudge about?" comparisons. */
export function chatPageContextKey(context: ChatPageContext): string {
	return context.productId ?? context.categoryLabel ?? context.kind;
}

/**
 * Templated, display-only teaser for the proactive nudge — no LLM call, so it
 * costs zero tokens and renders instantly. Phrased like a real teammate.
 */
export function buildChatNudgeLine(context: ChatPageContext): string {
	switch (context.kind) {
		case "product":
			return context.productName
				? `Looking at the ${context.productName}? I can check stock or current deals 👋`
				: "Looking at this one? I can check stock or current deals 👋";
		case "category":
			return context.categoryLabel ? `Exploring ${context.categoryLabel}? Happy to help you compare or find the best price 👋` : "Need a hand comparing options? I'm right here 👋";
		case "deals":
			return "Want me to point you to today's best deals? 👋";
		case "cart":
			return "Ready to check out? Tell me if anything's unclear 👋";
		default:
			return "Need a hand finding the right product? I'm here to help 👋";
	}
}
