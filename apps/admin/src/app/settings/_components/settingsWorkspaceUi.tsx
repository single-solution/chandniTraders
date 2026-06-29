"use client";

import type { ReactNode } from "react";
import { classNames } from "@store/shared";
import { CheckCircle2, Circle, type LucideIcon } from "lucide-react";
import { Button } from "@store/ui";
import { Skeleton } from "@/components/ui/Skeleton";

export type SettingsTabId = "urls" | "store" | "contact" | "payments" | "delivery" | "notices" | "policies" | "loyalty" | "inventory" | "integrations" | "seo" | "chat" | "cleanup";

export interface SettingsTabMeta {
	id: SettingsTabId;
	label: string;
	description: string;
}

export interface SettingsNavGroup {
	id: string;
	label: string;
	tabs: SettingsTabMeta[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
	{
		id: "general",
		label: "General",
		tabs: [
			{
				id: "urls",
				label: "Site URLs",
				description: "Public storefront address used for SEO, sitemaps, canonical links, and admin product links.",
			},
			{
				id: "store",
				label: "Store details",
				description: "Site name, tagline, and brand logos shown across the storefront and chat.",
			},
			{
				id: "contact",
				label: "Contact",
				description: "Support phone, email, WhatsApp, and the physical outlet address on the site.",
			},
		],
	},
	{
		id: "commerce",
		label: "Commerce",
		tabs: [
			{
				id: "payments",
				label: "Payments",
				description: "Toggle card and cash-on-delivery at checkout, COD surcharge %, and optional chip notes per method.",
			},
			{
				id: "delivery",
				label: "Delivery",
				description: "Free-delivery threshold applied at checkout.",
			},
			{
				id: "notices",
				label: "Notices",
				description: "Global delivery notes and store-wide banner alerts.",
			},
			{
				id: "loyalty",
				label: "Loyalty",
				description: "Earn rate and bonus points shown on account and checkout.",
			},
			{
				id: "policies",
				label: "Policies",
				description: "Money-back window and default warranty surfaced on product pages.",
			},
			{
				id: "inventory",
				label: "Inventory",
				description: "Stock alert threshold that drives the dashboard low-stock KPI and the bell-menu warning.",
			},
		],
	},
	{
		id: "storefront",
		label: "Storefront",
		tabs: [
			{
				id: "seo",
				label: "SEO",
				description: "Global meta defaults, Open Graph image, and organization structured data.",
			},
			{
				id: "chat",
				label: "Chat widget",
				description: "Floating support chat, welcome messages, and automated replies.",
			},
			{
				id: "integrations",
				label: "Integrations",
				description: "Social profile links shown across the storefront and tracking pixels (Meta, Google Analytics, Tag Manager, TikTok) injected into every page.",
			},
		],
	},
	{
		id: "advanced",
		label: "Advanced",
		tabs: [
			{
				id: "cleanup",
				label: "Data cleanup",
				description: "Bulk-delete test or legacy records. Store settings are never removed.",
			},
		],
	},
];

const TAB_META = new Map(SETTINGS_NAV_GROUPS.flatMap((group) => group.tabs.map((tab) => [tab.id, tab] as const)));

export function getSettingsTabMeta(id: SettingsTabId): SettingsTabMeta {
	return TAB_META.get(id) ?? { id, label: id, description: "" };
}

export function isSettingsTabId(value: string | null): value is SettingsTabId {
	return value !== null && TAB_META.has(value as SettingsTabId);
}

export function SettingsNavItem({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className={classNames(
					"flex w-full rounded-[var(--radius-md)] px-2.5 py-1.5 text-left text-[13px] transition-all",
					isActive
						? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-900)] shadow-sm"
						: "text-[var(--color-ink-700)] hover:-translate-y-px hover:bg-[var(--color-surface)] hover:text-[var(--color-ink-900)] hover:shadow-sm",
				)}
			>
				<span className="truncate">{label}</span>
			</button>
		</li>
	);
}

export function SettingsMobileTabChip({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={classNames(
				"inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all hover:-translate-y-px hover:shadow-sm",
				isActive
					? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] shadow-sm"
					: "border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-600)] shadow-[var(--shadow-sm)] hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
			)}
		>
			{label}
		</button>
	);
}

/**
 * Tab heading rendered above each tab's form card.
 *
 * Lives INSIDE the scrollable content area (not as a sticky chrome bar) so
 * the title and description scroll with the form. Sized prominently so the
 * active tab feels like a page within Settings rather than a tooltip.
 */
export function SettingsPanelHeader({ title, description }: { title: string; description: string }) {
	return (
		<header className="reveal animate-in px-4 pt-4 md:px-5 md:pt-5">
			<h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)] md:text-base">{title}</h2>
			<p className="mt-1 max-w-prose text-[11.5px] leading-relaxed text-[var(--color-ink-500)] md:text-xs">{description}</p>
		</header>
	);
}

export type SettingsHeroMetricTone = "good" | "warn" | "neutral" | "off";

export interface SettingsHeroMetric {
	label: string;
	value: string;
	hint?: string;
	tone?: SettingsHeroMetricTone;
	icon?: LucideIcon;
}

const TONE_STYLES: Record<SettingsHeroMetricTone, string> = {
	good: "bg-emerald-50 text-emerald-800 border-emerald-100",
	warn: "bg-amber-50 text-amber-800 border-amber-100",
	neutral: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)] border-[var(--color-ink-100)]",
	off: "bg-[var(--color-canvas)] text-[var(--color-ink-500)] border-[var(--color-ink-100)]",
};

/**
 * Status strip that sits at the top of each settings tab — gives an at-a-glance
 * read on what's currently configured (e.g. "3 of 4 payment methods enabled")
 * before the admin starts editing fields. Optional `actions` slot houses CTAs
 * like "Test call" or "Open inbox".
 *
 * Modelled on the chat-settings tab's status row that the team called out as
 * the right design — shipped as a reusable component so every tab gets the
 * same shape rather than each rolling its own.
 */
export function SettingsTabHero({ metrics, actions, description }: { metrics: SettingsHeroMetric[]; actions?: ReactNode; description?: string }) {
	return (
		<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-3 md:p-4">
			{description ? <p className="mb-3 max-w-prose text-[11.5px] leading-relaxed text-[var(--color-ink-600)] md:text-[12px]">{description}</p> : null}
			<div className="flex flex-wrap items-stretch gap-2">
				{metrics.map((metric) => {
					const Icon = metric.icon ?? (metric.tone === "good" ? CheckCircle2 : Circle);
					return (
						<div
							key={metric.label}
							className={classNames("flex min-w-[140px] flex-1 items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2", TONE_STYLES[metric.tone ?? "neutral"])}
						>
							<Icon size={14} className="mt-0.5 shrink-0" aria-hidden />
							<div className="min-w-0 flex-1 leading-tight">
								<p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{metric.label}</p>
								<p className="mt-0.5 truncate text-[13px] font-semibold">{metric.value}</p>
								{metric.hint ? <p className="mt-0.5 truncate text-[10.5px] opacity-80">{metric.hint}</p> : null}
							</div>
						</div>
					);
				})}
			</div>
			{actions ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-ink-100)] pt-3">{actions}</div> : null}
		</div>
	);
}

/**
 * Compact 2-column responsive grid for stacking short text/number fields
 * inside a FormSection. Falls back to a single column on phones; drops to
 * two columns at `md:` so a desktop monitor can pair, e.g., "Account title"
 * and "Wallet number" on the same row.
 */
export function FormGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
	return <div className={classNames("grid gap-3 md:gap-4", cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}

/**
 * Scrollable form body with optional sticky save footer inside the panel.
 *
 * Always stretches to the full width of the settings tab area so dense
 * surfaces like chat assistant settings and SEO previews can use
 * every available pixel. The form card itself caps individual fields with
 * `max-w-prose` to keep short inputs from spanning huge monitors.
 */
export function SettingsFormPanel({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
	return (
		<div className="w-full p-4 md:p-5">
			<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
				<div className="px-4 md:px-6">{children}</div>
				{footer}
			</div>
		</div>
	);
}

export function SettingsSaveFooter({
	onSave,
	onDiscard,
	saveLabel = "Save changes",
	discardLabel = "Discard",
	hint,
	showDiscard,
	dirtyCount,
}: {
	onSave: () => void;
	onDiscard?: () => void;
	saveLabel?: string;
	discardLabel?: string;
	hint?: string;
	showDiscard?: boolean;
	/** When provided, replaces the generic dirty hint with a concrete count. */
	dirtyCount?: number;
}) {
	const computedHint =
		hint ??
		(dirtyCount && dirtyCount > 0
			? `${dirtyCount} unsaved ${dirtyCount === 1 ? "change" : "changes"} on this tab.`
			: "Up to date — changes appear on the storefront within about a minute.");
	return (
		<div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2 md:gap-3 md:px-6 md:py-3">
			<p className="text-[10.5px] text-[var(--color-ink-500)] md:text-[11px]">{computedHint}</p>
			<div className="flex items-center gap-2">
				{showDiscard && onDiscard ? (
					<Button variant="ghost" size="sm" onClick={onDiscard} type="button">
						{discardLabel}
					</Button>
				) : null}
				<Button variant="primary" size="sm" onClick={onSave} type="button" disabled={saveLabel === "Saved"}>
					{saveLabel}
				</Button>
			</div>
		</div>
	);
}

export function SettingsLoadingPanel() {
	return (
		<SettingsFormPanel>
			<div className="space-y-6 py-6">
				<div className="space-y-2">
					<Skeleton shape="text" className="h-4 w-32" />
					<Skeleton shape="text" className="h-3 w-full max-w-md" />
				</div>
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton key={index} shape="text" className="h-10 w-full" />
				))}
			</div>
		</SettingsFormPanel>
	);
}
