"use client";

import Link from "next/link";
import { Copy, ShieldCheck } from "lucide-react";
import { Button } from "@store/ui";
import { StatusPill } from "@/components/shared/StatusPill";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { formatActivityAction, resolveResourceUrl } from "@/lib/activityLabels";
import { ROLE_DESCRIPTIONS, ROLE_LABEL, ROLE_TAGLINE, ROLE_TONE, rolePermissionCount } from "@/lib/roleCatalog";
import { classNames, formatTimeAgo } from "@store/shared";
import type { AdminActivityEntry, AdminUser } from "@/types/models";
import type { UserRole } from "@store/db";
import { ActivityDetailGrid } from "@/components/shared/ActivityDetailGrid";

import { TeamStatCard, type TeamMemberTab } from "./teamDetailUi";

export function OverviewTab({
	member,
	activity,
	activityTotal,
	canViewActivity,
	onCopyId,
	onOpenRoles,
	onGoTab,
}: {
	member: AdminUser;
	activity: AdminActivityEntry[];
	activityTotal: number;
	canViewActivity: boolean;
	onCopyId: () => void;
	onOpenRoles: () => void;
	onGoTab: (tab: TeamMemberTab) => void;
}) {
	const lastSignIn = member.lastSignInAt ? formatTimeAgo(member.lastSignInAt) : "Never";
	const memberSince = new Date(member.createdAt).toLocaleDateString("en-PK", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
	const totalPerms = rolePermissionCount(member.role);

	return (
		<div className="space-y-5">
			<div className="grid gap-3 sm:grid-cols-3">
				<TeamStatCard label="Last sign-in" value={lastSignIn} />
				<TeamStatCard label="Member since" value={memberSince} />
				<TeamStatCard label="Permissions" value={`${totalPerms}`} sub={`${ROLE_LABEL[member.role]} role`} />
			</div>

			<RoleSummaryCard role={member.role} onOpen={onOpenRoles} />

			<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Account</p>
				<ul className="mt-3 space-y-2 text-xs text-[var(--color-ink-700)]">
					<li className="flex flex-wrap items-center gap-2">
						<span className="text-[var(--color-ink-500)]">User ID</span>
						<code className="rounded bg-[var(--color-canvas-deep)] px-1.5 py-0.5 font-mono text-[10px]">{member.id}</code>
						<Button variant="ghost" size="sm" leadingIcon={<Copy size={11} />} onClick={onCopyId}>
							Copy
						</Button>
					</li>
					<li>
						<span className="text-[var(--color-ink-500)]">Sign-in email</span>
						<span className="ml-2">{member.email}</span>
					</li>
					{member.phoneNumber ? (
						<li>
							<span className="text-[var(--color-ink-500)]">Phone</span>
							<span className="ml-2">{member.phoneNumber}</span>
						</li>
					) : null}
					<li>
						<span className="text-[var(--color-ink-500)]">Profile updated</span>
						<span className="ml-2">{formatTimeAgo(member.updatedAt)}</span>
					</li>
				</ul>
			</section>

			{canViewActivity ? (
				<section>
					<div className="mb-2 flex items-center justify-between">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Recent activity</p>
						{activityTotal > 0 ? (
							<Button variant="ghost" size="sm" onClick={() => onGoTab("activity")}>
								View all ({activityTotal})
							</Button>
						) : null}
					</div>
					<ActivityList entries={activity.slice(0, 5)} compact />
				</section>
			) : null}
		</div>
	);
}

export function RoleSummaryCard({ role, onOpen }: { role: UserRole; onOpen: () => void }) {
	return (
		<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-3 md:p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)]">
					<ShieldCheck size={16} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<h4 className="text-[13px] font-semibold text-[var(--color-ink-900)]">{ROLE_LABEL[role]}</h4>
						<StatusPill tone={ROLE_TONE[role]}>{ROLE_TAGLINE[role]}</StatusPill>
					</div>
					<p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-600)]">{ROLE_DESCRIPTIONS[role]}</p>
				</div>
				<Button variant="ghost" size="sm" onClick={onOpen} type="button">
					See permissions
				</Button>
			</div>
		</section>
	);
}

export function ActivityTab({ entries }: { entries: AdminActivityEntry[] }) {
	if (entries.length === 0) {
		return (
			<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-8 text-center text-xs text-[var(--color-ink-500)]">
				No activity recorded yet. Actions appear here as soon as this member starts using the admin.
			</p>
		);
	}
	return <ActivityList entries={entries} />;
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

function ActivityList({ entries, compact }: { entries: AdminActivityEntry[]; compact?: boolean }) {
	if (entries.length === 0) {
		return <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-6 text-center text-xs text-[var(--color-ink-500)]">Nothing yet.</p>;
	}
	return (
		<ul className="space-y-1.5">
			{entries.map((entry) => (
				<li
					key={entry.id}
					className={classNames("rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2 text-xs", compact && "py-1.5")}
				>
					<p className="font-semibold text-[var(--color-ink-900)]">
						{formatActivityAction(entry.action)} · {getResourceLink(entry)}
					</p>
					<p className="text-[10px] text-[var(--color-ink-500)]">
						{entry.resourceType} · {formatTimeAgo(entry.createdAt)}
					</p>
					<ActivityDetailGrid detail={entry.detail || ""} />
				</li>
			))}
		</ul>
	);
}
