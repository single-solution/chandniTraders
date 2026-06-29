"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Fired when a client navigation commits — RevealRoot re-scans for entrances. */
export const ROUTE_REVEAL_EVENT = "storefront:route-reveal";

export function dispatchRouteReveal(): void {
	if (typeof window === "undefined") {
		return;
	}
	window.dispatchEvent(new Event(ROUTE_REVEAL_EVENT));
}

/**
 * Single, app-wide IntersectionObserver that flips any `.reveal` element
 * into the visible state once it scrolls into view.
 */
const REVEAL_CANDIDATE = ".reveal:not([data-reveal='visible']), .reveal-fade:not([data-reveal='visible'])";
const REVEAL_WATCHDOG_MS = 4000;

function isScrollRevealTarget(element: Element): boolean {
	return element.classList.contains("reveal-scroll") || Boolean(element.closest(".reveal-scroll-list"));
}

function RevealRootSearchSync({ onSearchKey }: { onSearchKey: (key: string) => void }) {
	const searchParams = useSearchParams();

	useEffect(() => {
		onSearchKey(searchParams?.toString() ?? "");
	}, [searchParams, onSearchKey]);

	return null;
}

function RevealRootDriver({ routeKey }: { routeKey: string }) {
	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const reveal = (target: Element, viaScroll = false) => {
			if (viaScroll || isScrollRevealTarget(target)) {
				(target as HTMLElement).style.setProperty("--reveal-delay", "0ms");
			}
			target.setAttribute("data-reveal", "visible");
		};

		const isInViewport = (element: HTMLElement): boolean => {
			const rect = element.getBoundingClientRect();
			const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
			const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
			return rect.top < viewportHeight * 0.92 && rect.bottom > viewportHeight * 0.04 && rect.left < viewportWidth && rect.right > 0;
		};

		const supportsIO = "IntersectionObserver" in window;

		let observer: IntersectionObserver | null = null;
		let mutation: MutationObserver | null = null;

		const observeAll = () => {
			if (!supportsIO || !observer) {
				document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
					reveal(element, isScrollRevealTarget(element));
				});
				return;
			}
			document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
				if (isInViewport(element)) {
					reveal(element, isScrollRevealTarget(element));
					return;
				}
				observer?.observe(element);
			});
		};

		const visitAddedNode = (node: HTMLElement) => {
			if (node.matches?.(REVEAL_CANDIDATE)) {
				if (isInViewport(node)) {
					reveal(node, isScrollRevealTarget(node));
				} else {
					observer?.observe(node);
				}
			}
			const querySelector = node.querySelector?.bind(node);
			if (!querySelector || !querySelector(".reveal, .reveal-fade")) {
				return;
			}
			node.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
				if (isInViewport(element)) {
					reveal(element, isScrollRevealTarget(element));
				} else {
					observer?.observe(element);
				}
			});
		};

		const bootstrap = () => {
			if (supportsIO) {
				observer = new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (entry.isIntersecting) {
								reveal(entry.target, true);
								observer?.unobserve(entry.target);
							}
						}
					},
					{
						rootMargin: "0px 0px -5% 0px",
						threshold: 0.06,
					},
				);
			}

			observeAll();
			document.documentElement.classList.remove("no-js");

			mutation = new MutationObserver((records) => {
				for (const record of records) {
					record.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement) {
							visitAddedNode(node);
						}
					});
				}
			});

			const mutationRoot = document.querySelector("main") ?? document.body;
			mutation.observe(mutationRoot, { childList: true, subtree: true });
		};

		const frame = window.requestAnimationFrame(bootstrap);

		const onRouteReveal = () => {
			window.requestAnimationFrame(observeAll);
		};
		window.addEventListener(ROUTE_REVEAL_EVENT, onRouteReveal);

		const watchdog = window.setTimeout(() => {
			document.querySelectorAll<HTMLElement>(REVEAL_CANDIDATE).forEach((element) => {
				if (isInViewport(element)) {
					reveal(element, isScrollRevealTarget(element));
				}
			});
		}, REVEAL_WATCHDOG_MS);

		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(watchdog);
			window.removeEventListener(ROUTE_REVEAL_EVENT, onRouteReveal);
			observer?.disconnect();
			mutation?.disconnect();
		};
	}, [routeKey]);

	return null;
}

export function RevealRoot() {
	const pathname = usePathname();
	const [searchKey, setSearchKey] = useState("");
	const onSearchKey = useCallback((key: string) => {
		setSearchKey(key);
	}, []);
	const routeKey = `${pathname}?${searchKey}`;

	return (
		<>
			<RevealRootDriver routeKey={routeKey} />
			<Suspense fallback={null}>
				<RevealRootSearchSync onSearchKey={onSearchKey} />
			</Suspense>
		</>
	);
}
