"use client";

import { useMemo, useState } from "react";
import { Check, Minus, ShieldCheck, X as XIcon } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { StatusPill } from "@/components/shared/StatusPill";
import { TabList } from "@/components/ui/Tabs";
import { Button } from "@store/ui";
import { classNames } from "@store/shared";
import { ROLE_PERMISSIONS, type PermissionKey } from "@/lib/permissionsCatalog";
import { PERMISSION_GROUPS, PERMISSION_LABEL, ROLE_DESCRIPTIONS, ROLE_LABEL, ROLE_ORDER, ROLE_TAGLINE, ROLE_TONE, rolePermissionCount } from "@/lib/roleCatalog";
import type { UserRole } from "@store/db";

interface TeamRolesModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialRole?: UserRole;
	/** Optional counts of members per role so the modal can show usage at a glance. */
	memberCounts?: Partial<Record<UserRole, number>>;
}

const TOTAL_PERMISSIONS = (Object.keys(PERMISSION_LABEL) as PermissionKey[]).length;

export function TeamRolesModal({ isOpen, onClose, initialRole = "owner", memberCounts }: TeamRolesModalProps) {
	const [activeRole, setActiveRole] = useState<UserRole>(initialRole);

	const granted = useMemo(() => new Set(ROLE_PERMISSIONS[activeRole]), [activeRole]);
	const grantedCount = rolePermissionCount(activeRole);

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title="Roles & permissions"
			description="What each admin role can see and do. Change a teammate's role from their profile."
			width="xl"
			bodyClassName="px-0 py-0"
			footer={
				<div className="flex items-center justify-between gap-2">
					<p className="text-[11px] text-[var(--color-ink-500)]">
						Roles are managed in code. To change what a role can do, ask your engineer to update{" "}
						<code className="rounded bg-[var(--color-canvas-deep)] px-1 py-0.5 font-mono text-[10px]">permissionsCatalog.ts</code>.
					</p>
					<Button variant="secondary" size="sm" onClick={onClose}>
						Close
					</Button>
				</div>
			}
		>
			<TabList
				tabs={ROLE_ORDER.map((role) => ({
					id: role,
					label: ROLE_LABEL[role],
					count: memberCounts?.[role],
				}))}
				activeId={activeRole}
				onChange={(id) => setActiveRole(id as UserRole)}
				compact
				fillWhenFew={false}
				aria-label="Roles"
				className="sticky top-0 z-10 bg-[var(--color-surface)] px-3 md:px-4"
			/>

			<div className="space-y-4 px-3 py-4 md:space-y-5 md:px-5 md:py-5">
				<RoleHeaderCard role={activeRole} grantedCount={grantedCount} totalCount={TOTAL_PERMISSIONS} memberCount={memberCounts?.[activeRole]} />

				<div className="grid gap-3 md:grid-cols-2">
					{PERMISSION_GROUPS.map((group) => (
						<PermissionGroupCard key={group.id} group={group} granted={granted} />
					))}
				</div>
			</div>
		</Drawer>
	);
}

function RoleHeaderCard({ role, grantedCount, totalCount, memberCount }: { role: UserRole; grantedCount: number; totalCount: number; memberCount?: number }) {
	return (
		<section className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-3 md:p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)] md:size-10">
					<ShieldCheck size={17} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<h3 className="text-sm font-semibold text-[var(--color-ink-900)] md:text-[15px]">{ROLE_LABEL[role]}</h3>
						<StatusPill tone={ROLE_TONE[role]}>{ROLE_TAGLINE[role]}</StatusPill>
						{typeof memberCount === "number" ? (
							<StatusPill tone="neutral">
								{memberCount} {memberCount === 1 ? "member" : "members"}
							</StatusPill>
						) : null}
					</div>
					<p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-600)] md:text-xs">{ROLE_DESCRIPTIONS[role]}</p>
					<div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-ink-500)]">
						<div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-[var(--color-ink-100)]" aria-hidden>
							<div className="h-full rounded-full bg-[var(--color-accent-500)]" style={{ width: `${(grantedCount / totalCount) * 100}%` }} />
						</div>
						<span className="tabular-nums font-semibold text-[var(--color-ink-700)]">{grantedCount}</span>
						<span>of {totalCount} permissions</span>
					</div>
				</div>
			</div>
		</section>
	);
}

function PermissionGroupCard({ group, granted }: { group: (typeof PERMISSION_GROUPS)[number]; granted: Set<PermissionKey> }) {
	const totalInGroup = group.permissions.length;
	const grantedInGroup = group.permissions.filter((permission) => granted.has(permission)).length;
	const fullyDenied = grantedInGroup === 0;
	const fullyGranted = grantedInGroup === totalInGroup;

	return (
		<section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
			<header className="flex items-start justify-between gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2">
				<div className="min-w-0">
					<h4 className="text-[12px] font-semibold text-[var(--color-ink-900)] md:text-[13px]">{group.label}</h4>
					<p className="text-[10.5px] text-[var(--color-ink-500)]">{group.description}</p>
				</div>
				<span
					className={classNames(
						"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
						fullyGranted
							? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
							: fullyDenied
								? "bg-[var(--color-ink-100)] text-[var(--color-ink-500)]"
								: "bg-amber-100 text-amber-800",
					)}
				>
					{grantedInGroup}/{totalInGroup}
				</span>
			</header>
			<ul className="divide-y divide-[var(--color-ink-100)]">
				{group.permissions.map((permission) => {
					const isGranted = granted.has(permission);
					return (
						<li
							key={permission}
							className={classNames("flex items-center gap-2 px-3 py-1.5 text-[12px]", isGranted ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]")}
						>
							<span
								className={classNames(
									"grid size-4 shrink-0 place-items-center rounded-full",
									isGranted ? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]",
								)}
								aria-hidden
							>
								{isGranted ? <Check size={10} strokeWidth={3} /> : <Minus size={10} />}
							</span>
							<span className="flex-1">{PERMISSION_LABEL[permission]}</span>
							{!isGranted ? <XIcon size={10} className="shrink-0 text-[var(--color-ink-300)]" aria-label="Not granted" /> : null}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
