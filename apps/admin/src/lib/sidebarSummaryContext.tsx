"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api";

export interface SidebarSummary {
	ordersUnread: number;
	customersUnread: number;
	inquiriesUnread: number;
}

const POLL_INTERVAL_MS = 30_000;

const SidebarSummaryContext = createContext<SidebarSummary | null>(null);

export function SidebarSummaryProvider({ children }: { children: ReactNode }) {
	const [summary, setSummary] = useState<SidebarSummary | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const data = await apiFetch<SidebarSummary>("/api/sidebar/summary");
				if (!cancelled) {
					setSummary(data);
				}
			} catch {
				// ignore — badges stay hidden until the next poll
			}
		}

		void load();
		const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);

	return <SidebarSummaryContext.Provider value={summary}>{children}</SidebarSummaryContext.Provider>;
}

export function useSidebarSummary(): SidebarSummary | null {
	return useContext(SidebarSummaryContext);
}
