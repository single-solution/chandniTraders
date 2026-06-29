"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, KeyRound, LogIn, LogOut, Mail, Pencil, Plus, RefreshCcw, Trash2, type LucideIcon } from "lucide-react";
import { classNames } from "@store/shared";
import { StatusPill, type StatusTone } from "@/components/shared/StatusPill";
import { WorkspaceEmptyPane, WorkspaceFilterChip, WorkspaceFrame, WorkspacePaneHeader, WorkspaceSearchField, WorkspaceSidebarNavItem } from "@/components/shared/workspaceUi";
import { formatActivityAction, resolveResourceUrl } from "@/lib/activityLabels";
import { ActivityDetailGrid } from "@/components/shared/ActivityDetailGrid";
import type { AdminActivityEntry, AdminActivityResourceType } from "@/types/models";

type Action = AdminActivityEntry["action"];

const ACTION_ICONS: Record<string, LucideIcon> = {
	created: Plus,
	updated: Pencil,
	deleted: Trash2,
	archived: Archive,
	restored: RefreshCcw,
	status_changed: CheckCircle2,
	login: LogIn,
	logout: LogOut,
	invited: Mail,
	signin_code_issued: KeyRound,
};

const ACTION_TONE: Record<string, StatusTone> = {
	created: "success",
	updated: "info",
	deleted: "danger",
	archived: "warn",
	restored: "accent",
	status_changed: "info",
	login: "neutral",
	logout: "neutral",
	invited: "accent",
	signin_code_issued: "warn",
};

const TONE_CIRCLE: Record<StatusTone, string> = {
	neutral: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-600)]",
	info: "bg-sky-50 text-sky-700",
	success: "bg-[var(--color-accent-50)] text-[var(--color-accent-700)]",
	warn: "bg-amber-50 text-amber-700",
	danger: "bg-rose-50 text-rose-700",
	accent: "bg-[var(--color-accent-50)] text-[var(--color-accent-800)]",
	dark: "bg-[var(--color-ink-900)] text-white",
};

const RESOURCE_LABELS: Record<AdminActivityResourceType, string> = {
	product: "Products",
	brand: "Brands",
	category: "Categories",
	attribute: "Attributes",
	order: "Orders",
	customer: "Customers",
	loyalty: "Loyalty",
	inquiry: "Inquiries",
	offer: "Offers",
	team: "Team",
	settings: "Settings",
	auth: "Auth",
};

function resourceLabel(type: AdminActivityResourceType): string {
	return RESOURCE_LABELS[type] ?? type;
}

function formatTimestamp(value: string): string {
	return new Date(value).toLocaleString("en-PK", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

interface ActivityFeedProps {
	entries: AdminActivityEntry[];
}

function getResourceLink(entry: AdminActivityEntry) {
	const label = entry.resourceLabel || entry.resourceType;
	const href = resolveResourceUrl(entry.resourceType, entry.resourceId);
	if (href) {
		return (
			<Link href={href} className="hover:text-[var(--color-accent-700)] hover:underline">
				{label}
			</Link>
		);
	}
	return <span>{label}</span>;
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
	const [resourceFilter, setResourceFilter] = useState<"all" | AdminActivityResourceType>("all");
	const [actionFilter, setActionFilter] = useState<"all" | Action>("all");
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);

	const resourceOptions = useMemo(() => {
		const present = Array.from(new Set(entries.map((entry) => entry.resourceType)));
		present.sort((first, second) => resourceLabel(first).localeCompare(resourceLabel(second)));
		return present;
	}, [entries]);

	const actionOptions = useMemo(() => {
		const present = Array.from(new Set(entries.map((entry) => entry.action)));
		return present.sort();
	}, [entries]);

	const resourceCounts = useMemo(() => {
		const map = new Map<string, number>();
		for (const entry of entries) {
			map.set(entry.resourceType, (map.get(entry.resourceType) ?? 0) + 1);
		}
		return map;
	}, [entries]);

	const actionCounts = useMemo(() => {
		const map = new Map<string, number>();
		for (const entry of entries) {
			map.set(entry.action, (map.get(entry.action) ?? 0) + 1);
		}
		return map;
	}, [entries]);

	const filtered = useMemo(() => {
		const term = deferredQuery.trim().toLowerCase();
		return entries.filter((entry) => {
			if (resourceFilter !== "all" && entry.resourceType !== resourceFilter) {
				return false;
			}
			if (actionFilter !== "all" && entry.action !== actionFilter) {
				return false;
			}
			if (!term) {
				return true;
			}
			return `${entry.actorName} ${entry.actorRole} ${entry.resourceType} ${entry.resourceLabel} ${entry.detail ?? ""} ${formatActivityAction(entry.action)}`
				.toLowerCase()
				.includes(term);
		});
	}, [entries, resourceFilter, actionFilter, deferredQuery]);

	if (entries.length === 0) {
		return (
			<WorkspaceFrame>
				<WorkspacePaneHeader
					iconElement={<Activity size={15} className="shrink-0 text-[var(--color-accent-700)]" />}
					title="Activity log"
					subtitle="Every change made by admins, with timestamps and actors."
				/>
				<WorkspaceEmptyPane iconElement={<Activity size={22} />} title="No activity yet" description="Admin actions will appear here as they happen." />
			</WorkspaceFrame>
		);
	}

	return (
		<WorkspaceFrame>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-52">
					<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Resource Type</p>
					<nav aria-label="Resource type views" className="-mx-1 flex-1 overflow-y-auto mb-4 max-h-[50%]">
						<ul className="flex flex-col gap-0.5">
							<WorkspaceSidebarNavItem label="All Types" count={entries.length} isActive={resourceFilter === "all"} onClick={() => setResourceFilter("all")} />
							{resourceOptions.map((type) => (
								<WorkspaceSidebarNavItem
									key={type}
									label={resourceLabel(type)}
									count={resourceCounts.get(type) ?? 0}
									isActive={resourceFilter === type}
									onClick={() => setResourceFilter(type)}
								/>
							))}
						</ul>
					</nav>

					<p className="mt-3 border-t border-[var(--color-ink-100)] pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Action</p>
					<nav aria-label="Action views" className="-mx-1 flex-1 overflow-y-auto">
						<ul className="flex flex-col gap-0.5">
							<WorkspaceSidebarNavItem label="All Actions" count={entries.length} isActive={actionFilter === "all"} onClick={() => setActionFilter("all")} />
							{actionOptions.map((action) => (
								<WorkspaceSidebarNavItem
									key={action}
									label={formatActivityAction(action)}
									count={actionCounts.get(action) ?? 0}
									isActive={actionFilter === action}
									onClick={() => setActionFilter(action)}
								/>
							))}
						</ul>
					</nav>
				</aside>

				<section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-canvas)]">
					<WorkspacePaneHeader
						iconElement={<Activity size={15} className="shrink-0 text-[var(--color-accent-700)]" />}
						title="Activity log"
						subtitle={`${filtered.length} shown · ${entries.length} total`}
						search={
							<WorkspaceSearchField
								value={query}
								onChange={setQuery}
								placeholder="Search actor, item, detail…"
								aria-label="Search activity"
								className="min-w-0 w-full lg:max-w-xs"
							/>
						}
					/>

					{/* Mobile filters fallback */}
					<div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[var(--color-ink-100)] lg:hidden">
						<WorkspaceFilterChip compact label="All Types" isActive={resourceFilter === "all"} onClick={() => setResourceFilter("all")} />
						{resourceOptions.map((type) => (
							<WorkspaceFilterChip key={type} compact label={resourceLabel(type)} isActive={resourceFilter === type} onClick={() => setResourceFilter(type)} />
						))}
						<div className="w-px h-4 bg-[var(--color-ink-200)] mx-1" />
						<WorkspaceFilterChip compact label="All Actions" isActive={actionFilter === "all"} onClick={() => setActionFilter("all")} />
						{actionOptions.map((action) => (
							<WorkspaceFilterChip key={action} compact label={formatActivityAction(action)} isActive={actionFilter === action} onClick={() => setActionFilter(action)} />
						))}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto p-2.5 md:p-3">
						{filtered.length === 0 ? (
							<WorkspaceEmptyPane
								iconElement={<Activity size={22} />}
								title="No matching activity"
								description="Try another filter or clear the search."
								action={
									<button
										type="button"
										onClick={() => {
											setResourceFilter("all");
											setActionFilter("all");
											setQuery("");
										}}
										className="text-xs font-semibold text-[var(--color-accent-700)] hover:underline"
									>
										Clear filters
									</button>
								}
							/>
						) : (
							<ul className="space-y-3">
								{filtered.map((entry) => {
									const Icon = ACTION_ICONS[entry.action] ?? Pencil;
									const tone = ACTION_TONE[entry.action] ?? "neutral";
									return (
										<li
											key={entry.id}
											className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3 shadow-sm transition-colors hover:border-[var(--color-ink-200)]"
										>
											<div className="flex items-start gap-2.5">
												<span className={classNames("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", TONE_CIRCLE[tone])}>
													<Icon size={11} />
												</span>
												<div className="min-w-0 flex-1">
													<div className="flex items-baseline justify-between gap-2">
														<p className="min-w-0 truncate text-[12.5px] text-[var(--color-ink-900)]">
															<span className="font-semibold">{entry.actorName}</span>
															<span className="text-[var(--color-ink-400)]"> · {entry.actorRole}</span>
														</p>
														<time dateTime={entry.createdAt} className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-[var(--color-ink-400)]">
															{formatTimestamp(entry.createdAt)}
														</time>
													</div>
													<p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] leading-snug text-[var(--color-ink-700)]">
														<StatusPill tone={tone}>{formatActivityAction(entry.action)}</StatusPill>
														<span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-400)]">{resourceLabel(entry.resourceType)}</span>
														{getResourceLink(entry)}
													</p>
												</div>
											</div>

											<ActivityDetailGrid detail={entry.detail || ""} />
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</section>
			</div>
		</WorkspaceFrame>
	);
}
