"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Core Web Vitals telemetry shim.
 *
 * Dual sink:
 *   1. GA4 via `gtag` when `MarketingPixels` configured a measurement id.
 *   2. `POST /api/vitals` as a fallback — structured logs via
 *      pino so we still have RUM when GA isn't set up yet.
 *
 * The beacon uses `keepalive` so it survives navigations away from the page.
 */
interface GtagWindow extends Window {
	gtag?: (command: "event", eventName: string, params: Record<string, unknown>) => void;
}

const ALLOWED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

function reportToGa4(metric: { name: string; value: number; id: string }) {
	const globalWindow = window as GtagWindow;
	if (typeof globalWindow.gtag !== "function") return;

	globalWindow.gtag("event", metric.name, {
		value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
		event_category: "web-vitals",
		event_label: metric.id,
		non_interaction: true,
	});
}

function reportToServer(metric: { name: string; value: number; id: string; rating: string; navigationType?: string }) {
	if (!ALLOWED_METRICS.has(metric.name)) return;

	void fetch("/api/vitals", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name: metric.name,
			value: metric.value,
			id: metric.id,
			rating: metric.rating,
			navigationType: metric.navigationType,
		}),
		keepalive: true,
	}).catch(() => {
		// RUM is best-effort — never surface to the user.
	});
}

export function WebVitalsReporter() {
	useReportWebVitals((metric) => {
		if (typeof window === "undefined") return;

		const payload = {
			name: metric.name,
			value: metric.value,
			id: metric.id,
			rating: metric.rating,
			navigationType: metric.navigationType,
		};

		reportToGa4(payload);

		const globalWindow = window as GtagWindow;
		if (typeof globalWindow.gtag !== "function") {
			reportToServer(payload);
		}
	});

	return null;
}
