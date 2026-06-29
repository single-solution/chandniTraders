"use client";

import { useStoreSettings } from "@/lib/storeSettingsContext";

import { AdminAlertsRow, useAdminAlerts } from "@/app/_components/dashboard/alertsUi";

export function Footer() {
	const { siteName } = useStoreSettings();
	const year = new Date().getFullYear();
	const alerts = useAdminAlerts();

	return (
		<footer className="hidden min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-1.5 text-[0.625rem] text-[var(--color-ink-500)] shadow-[var(--shadow-sm)] md:flex">
			<p className="min-w-0 truncate">
				© {year} {siteName} — Admin console
			</p>
			<AdminAlertsRow alerts={alerts} className="justify-end" />
		</footer>
	);
}
