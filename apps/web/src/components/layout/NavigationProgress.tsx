"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { dispatchRouteReveal } from "@/components/shared/motion/RevealRoot";
import { useNavigationProgressCount } from "@/lib/navigation/navigationProgress";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

/**
 * Thin progress bar that gives instant tap feedback on navigation.
 *
 * Click / popstate listeners sit in the same tree as the bar (outside the
 * `useSearchParams` Suspense child) so taps start the bar on the first
 * frame. Route commit detection needs search params and lives in
 * {@link NavigationProgressRouteSync}.
 */
const SHOW_AFTER_CLICK_MS = 0;
const TRICKLE_START_PERCENT = 30;
const TRICKLE_CEILING_PERCENT = 80;
const TRICKLE_STEP_PERCENT = 8;
const TRICKLE_INTERVAL_MS = 260;
const COMPLETION_FADE_MS = 340;
const SAME_ROUTE_AUTO_CANCEL_MS = 15000;

function NavigationProgressClickListener({ onStart }: { onStart: () => void }) {
	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			const anchor = (event.target as HTMLElement | null)?.closest("a");
			if (!anchor) {
				return;
			}
			if (anchor.target && anchor.target !== "_self") {
				return;
			}
			if (anchor.hasAttribute("download")) {
				return;
			}
			const href = anchor.getAttribute("href");
			if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
				return;
			}
			try {
				const targetUrl = new URL(href, window.location.href);
				if (targetUrl.origin !== window.location.origin) {
					return;
				}
				const nextKey = `${targetUrl.pathname}?${targetUrl.searchParams.toString()}`;
				const currentKey = `${window.location.pathname}?${window.location.search.slice(1)}`;
				if (nextKey === currentKey) {
					return;
				}
			} catch {
				return;
			}

			if (SHOW_AFTER_CLICK_MS === 0) {
				onStart();
			} else {
				window.setTimeout(onStart, SHOW_AFTER_CLICK_MS);
			}
		};

		document.addEventListener("click", handleClick, { capture: true });
		window.addEventListener("popstate", onStart);

		return () => {
			document.removeEventListener("click", handleClick, { capture: true });
			window.removeEventListener("popstate", onStart);
		};
	}, [onStart]);

	return null;
}

function NavigationProgressRouteSync({ onRouteCommit }: { onRouteCommit: () => void }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const lastRouteKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
		if (lastRouteKeyRef.current === null) {
			lastRouteKeyRef.current = routeKey;
			onRouteCommit();
			return;
		}
		if (routeKey === lastRouteKeyRef.current) {
			return;
		}
		lastRouteKeyRef.current = routeKey;
		onRouteCommit();
	}, [pathname, searchParams, onRouteCommit]);

	return null;
}

function NavigationProgressBar({ isVisible, percent }: { isVisible: boolean; percent: number }) {
	return (
		<div aria-hidden data-visible={isVisible ? "true" : "false"} className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[var(--z-max)] h-[2px]">
			<div className="nav-progress-bar h-full w-full bg-[var(--color-accent-500)]" style={{ transform: `scaleX(${percent / 100})` }} />
		</div>
	);
}

export function NavigationProgress() {
	const programmaticCount = useNavigationProgressCount();
	const [isVisible, setIsVisible] = useState(false);
	const [percent, setPercent] = useState(0);
	const trickleIntervalRef = useRef<number | null>(null);
	const fadeTimeoutRef = useRef<number | null>(null);
	const autoCancelTimeoutRef = useRef<number | null>(null);
	const programmaticActiveRef = useRef(false);

	const clearTrickle = useCallback(() => {
		if (trickleIntervalRef.current !== null) {
			window.clearInterval(trickleIntervalRef.current);
			trickleIntervalRef.current = null;
		}
	}, []);

	const clearFade = useCallback(() => {
		if (fadeTimeoutRef.current !== null) {
			window.clearTimeout(fadeTimeoutRef.current);
			fadeTimeoutRef.current = null;
		}
	}, []);

	const clearAutoCancel = useCallback(() => {
		if (autoCancelTimeoutRef.current !== null) {
			window.clearTimeout(autoCancelTimeoutRef.current);
			autoCancelTimeoutRef.current = null;
		}
	}, []);

	const completeNavigation = useCallback(() => {
		clearTrickle();
		clearAutoCancel();
		programmaticActiveRef.current = false;
		setPercent(100);
		clearFade();
		dispatchRouteReveal();
		fadeTimeoutRef.current = window.setTimeout(() => {
			setIsVisible(false);
			setPercent(0);
		}, COMPLETION_FADE_MS);
	}, [clearAutoCancel, clearFade, clearTrickle]);

	const startNavigation = useCallback(() => {
		clearFade();
		clearAutoCancel();
		setIsVisible(true);
		setPercent(TRICKLE_START_PERCENT);
		clearTrickle();
		trickleIntervalRef.current = window.setInterval(() => {
			setPercent((current) => {
				if (current >= TRICKLE_CEILING_PERCENT) {
					return current;
				}
				return Math.min(current + TRICKLE_STEP_PERCENT, TRICKLE_CEILING_PERCENT);
			});
		}, TRICKLE_INTERVAL_MS);
		autoCancelTimeoutRef.current = window.setTimeout(() => {
			completeNavigation();
		}, SAME_ROUTE_AUTO_CANCEL_MS);
	}, [clearAutoCancel, clearFade, clearTrickle, completeNavigation]);

	useEffect(() => {
		if (programmaticCount > 0) {
			programmaticActiveRef.current = true;
			scheduleStateUpdate(startNavigation);
			return;
		}
		if (programmaticActiveRef.current) {
			programmaticActiveRef.current = false;
			scheduleStateUpdate(completeNavigation);
		}
	}, [programmaticCount, startNavigation, completeNavigation]);

	useLayoutEffect(() => {
		startNavigation();
	}, [startNavigation]);

	useEffect(
		() => () => {
			clearTrickle();
			clearFade();
			clearAutoCancel();
		},
		[clearAutoCancel, clearFade, clearTrickle],
	);

	return (
		<>
			<NavigationProgressClickListener onStart={startNavigation} />
			<NavigationProgressBar isVisible={isVisible} percent={percent} />
			{isVisible ? (
				<div
					aria-hidden
					className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-[var(--color-accent-500)]/5 backdrop-blur-[1px]"
					style={{ animation: "nav-overlay-in 0.25s ease-out 0.45s both" }}
				>
					<div className="flex flex-col items-center justify-center text-[var(--color-ink-900)]">
						<div className="w-[clamp(7.5rem,30vw,13rem)] text-[var(--color-ink-700)] opacity-60">
							<svg className="w-full h-full animate-[spin_2.4s_linear_infinite] origin-center" viewBox="0 0 100 100" fill="none">
								<circle cx="50" cy="50" r="5.5" fill="currentColor" />
								<ellipse cx="50" cy="27" rx="7.5" ry="21" fill="currentColor" opacity="0.9" />
								<ellipse cx="50" cy="27" rx="7.5" ry="21" fill="currentColor" opacity="0.9" transform="rotate(120 50 50)" />
								<ellipse cx="50" cy="27" rx="7.5" ry="21" fill="currentColor" opacity="0.9" transform="rotate(240 50 50)" />
								<circle cx="50" cy="50" r="17" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
							</svg>
						</div>
					</div>
				</div>
			) : null}
			<Suspense fallback={null}>
				<NavigationProgressRouteSync onRouteCommit={completeNavigation} />
			</Suspense>
		</>
	);
}
