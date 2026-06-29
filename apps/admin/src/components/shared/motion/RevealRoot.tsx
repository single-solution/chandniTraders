"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Single, app-wide IntersectionObserver that flips any `.reveal` element
 * into the visible state once it scrolls into view. Pair with the
 * `.reveal` or `.reveal-fade` class for the actual animation.
 *
 * Architecture notes:
 *
 *   • **The hidden state is purely CSS.** A `.reveal` element starts at
 *     `opacity: 0` and animates in only when `data-reveal="visible"` is
 *     present. We do **not** render `data-reveal="hidden"` from SSR
 *     because that attribute was the root cause of React 19's hydration
 *     mismatch under Next 16's progressive Suspense hydration.
 *
 *   • **`no-js` is stripped HERE, not by an inline `<script>`.** The
 *     old layout shipped a tiny script that ran before this component
 *     mounted, which on slow networks left `.reveal` nodes invisible
 *     during the window between strip and hydration. Stripping at
 *     mount means the CSS fallback (`.no-js .reveal { opacity: 1 }`)
 *     stays effective until the animation driver is actually ready.
 *
 *   • **Watchdog reveal.** After {@link REVEAL_WATCHDOG_MS} ms any
 *     `.reveal` element that the IO hasn't promoted yet is force-
 *     revealed. Guarantees no content is invisible beyond that window
 *     regardless of bundle latency, hydration race, or IO bug. The
 *     CSS keyframe safety in `globals.css` is a second, independent
 *     layer that fires even if this component never mounts.
 *
 *   • **MutationObserver scoped to `<main>`.** Most dynamic content
 *     mounts there; observing the whole document body forced an extra
 *     callback on every chat-widget render. We fall back to `body` if
 *     `<main>` isn't present yet.
 *
 *   • **One observer per app, not per element.** We disconnect on
 *     unmount/route change and rebuild — keeps memory flat as the user
 *     navigates.
 */
const REVEAL_CANDIDATE = ".reveal:not([data-reveal='visible']), .reveal-fade:not([data-reveal='visible'])";
/** Safety window: any reveal still hidden after this fires automatically. */
const REVEAL_WATCHDOG_MS = 2500;

export function RevealRoot() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		// The component is mounted ⇒ the animation driver is alive ⇒ it is
		// safe to remove the CSS fallback that kept content visible for
		// no-JS / pre-hydration users.
		document.documentElement.classList.remove("no-js");

		const reveal = (target: Element) => {
			target.setAttribute("data-reveal", "visible");
		};

		const isInViewport = (element: HTMLElement): boolean => {
			const rect = element.getBoundingClientRect();
			const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
			return rect.top < viewportHeight * 0.94 && rect.bottom > 0;
		};

		const supportsIO = "IntersectionObserver" in window;
		if (!supportsIO) {
			document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach(reveal);
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						reveal(entry.target);
						observer.unobserve(entry.target);
					}
				}
			},
			{
				rootMargin: "0px 0px -6% 0px",
				threshold: 0.04,
			},
		);

		const observeAll = () => {
			document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
				if (isInViewport(element)) {
					reveal(element);
					return;
				}
				observer.observe(element);
			});
		};

		const visitAddedNode = (node: HTMLElement) => {
			if (node.matches?.(REVEAL_CANDIDATE)) {
				if (isInViewport(node)) {
					reveal(node);
				} else {
					observer.observe(node);
				}
			}
			// Cheap pre-check — if the subtree has no reveal targets, skip
			// the expensive `querySelectorAll` walk. Big win on chat-widget
			// / image-fade churn where most added nodes are irrelevant.
			const querySelector = node.querySelector?.bind(node);
			if (!querySelector || !querySelector(".reveal, .reveal-fade")) {
				return;
			}
			node.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
				if (isInViewport(element)) {
					reveal(element);
				} else {
					observer.observe(element);
				}
			});
		};

		const mutation = new MutationObserver((records) => {
			for (const record of records) {
				record.addedNodes.forEach((node) => {
					if (node instanceof HTMLElement) {
						visitAddedNode(node);
					}
				});
			}
		});

		// Run on the next frame so layout is settled, but don't defer to
		// idle — that left above-the-fold `.reveal` nodes at opacity 0 and
		// made the storefront feel like it was still loading.
		const frame = window.requestAnimationFrame(() => {
			observeAll();
			const mutationRoot = document.querySelector("main") ?? document.body;
			mutation.observe(mutationRoot, { childList: true, subtree: true });
		});

		// Watchdog — force-reveal anything still hidden after the budget.
		// This is the JS layer of the guarantee; the CSS keyframe in
		// `globals.css` is the independent backup if the JS never reaches
		// this point at all.
		const watchdog = window.setTimeout(() => {
			document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach(reveal);
		}, REVEAL_WATCHDOG_MS);

		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(watchdog);
			observer.disconnect();
			mutation.disconnect();
		};
	}, [routeKey]);

	return null;
}
