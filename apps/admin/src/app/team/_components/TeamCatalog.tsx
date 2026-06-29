"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ShieldCheck, Users } from "lucide-react";
import { Button } from "@store/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/ui/Toast";
import {
	WorkspaceEmptyPane,
	WorkspaceFilterChip,
	WorkspaceFrame,
	WorkspacePaneHeader,
	WorkspacePrimaryAction,
	WorkspaceReadOnlyBanner,
	WorkspaceSearchField,
	WorkspaceSidebarNavItem,
} from "@/components/shared/workspaceUi";
import { apiFetch } from "@/lib/api";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { pingNavigationProgress, useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { getInitials } from "@/lib/initials";
import { ROLE_LABEL, ROLE_ORDER, ROLE_TONE } from "@/lib/roleCatalog";
import { classNames, formatTimeAgo } from "@store/shared";
import type { AdminUser } from "@/types/models";
import type { UserRole } from "@store/db";

import { TeamMemberDetailPanel } from "./TeamMemberDetailPanel";

// Invite drawer + roles modal are click-gated dialogs — their JS only
// matters once the operator opens one. Lazy chunks keep /team's cold
// load lean.
const TeamInviteDrawer = dynamic(
	() =>
		import("./TeamInviteDrawer").then((mod) => ({
			default: mod.TeamInviteDrawer,
		})),
	{ ssr: false },
);
const TeamRolesModal = dynamic(() => import("./TeamRolesModal").then((mod) => ({ default: mod.TeamRolesModal })), { ssr: false });

type SegmentFilter = "all" | UserRole;

interface TeamCatalogProps {
	members: AdminUser[];
	currentUserId: string;
	isCurrentUserSuperAdmin: boolean;
}

export function TeamCatalog(props: TeamCatalogProps) {
	return (
		<Suspense fallback={null}>
			<TeamCatalogInner {...props} />
		</Suspense>
	);
}

function TeamCatalogInner({ members, currentUserId, isCurrentUserSuperAdmin }: TeamCatalogProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { startNavigation } = useNavigationTransition();
	const toast = useToast();
	const { can } = useAdminPermissions();

	const canInvite = can("team_invite");
	const canUpdate = can("team_update");
	const canRemove = can("team_remove");
	const canViewActivity = can("activity_view");

	const [segment, setSegment] = useState<SegmentFilter>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);
	const [isInviteOpen, setIsInviteOpen] = useState(false);
	// Track whether the dialog has ever been opened so the dynamic chunk
	// only loads on first interaction; subsequent opens reuse the cached
	// bundle and keep close animations smooth.
	const [inviteDrawerMounted, setInviteDrawerMounted] = useState(false);
	const [rolesModalMounted, setRolesModalMounted] = useState(false);
	const [toRemove, setToRemove] = useState<AdminUser | null>(null);
	const [rolesModal, setRolesModal] = useState<{ open: boolean; role: UserRole }>({
		open: false,
		role: "owner",
	});

	const segmentCounts = useMemo(() => {
		const base: Record<SegmentFilter, number> = {
			all: members.length,
			owner: 0,
			business_manager: 0,
			product_manager: 0,
			marketing_manager: 0,
			support_staff: 0,
		};
		for (const member of members) {
			base[member.role] += 1;
		}
		return base;
	}, [members]);

	const memberCountsByRole = useMemo(() => {
		const map: Partial<Record<UserRole, number>> = {};
		for (const role of ROLE_ORDER) {
			map[role] = segmentCounts[role];
		}
		return map;
	}, [segmentCounts]);

	const filteredMembers = useMemo(() => {
		let rows = members;
		if (segment !== "all") {
			rows = rows.filter((row) => row.role === segment);
		}
		const query = searchQuery.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((row) => `${row.name} ${row.email} ${row.phoneNumber ?? ""} ${ROLE_LABEL[row.role]}`.toLowerCase().includes(query));
	}, [members, segment, searchQuery]);

	const setActiveMemberUrl = useCallback(
		(id: string | null) => {
			setActiveId(id);
			const params = new URLSearchParams(searchParams.toString());
			if (id) {
				params.set("member", id);
			} else {
				params.delete("member");
			}
			const query = params.toString();
			const url = query ? `/team?${query}` : "/team";
			startNavigation(() => router.replace(url, { scroll: false }));
		},
		[router, searchParams, startNavigation],
	);

	const clearActive = useCallback(() => {
		setActiveMemberUrl(null);
	}, [setActiveMemberUrl]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			const fromUrl = searchParams.get("member");
			if (fromUrl && members.some((row) => row.id === fromUrl)) {
				setActiveId(fromUrl);
				return;
			}
			if (filteredMembers.length === 0) {
				if (activeId !== null) {
					setActiveMemberUrl(null);
				}
				return;
			}
			const stillVisible = activeId !== null && filteredMembers.some((row) => row.id === activeId);
			if (stillVisible) return;
			const preferDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
			setActiveMemberUrl(preferDesktop ? filteredMembers[0].id : null);
		});
	}, [activeId, filteredMembers, members, searchParams, setActiveMemberUrl]);

	function refresh() {
		pingNavigationProgress();
		router.refresh();
	}

	async function handleRemove() {
		if (!toRemove) return;
		try {
			await apiFetch(`/api/team/${toRemove.id}`, { method: "DELETE" });
			toast.warn(`${toRemove.name} removed`);
			const wasActive = activeId === toRemove.id;
			setToRemove(null);
			if (wasActive) setActiveMemberUrl(null);
			refresh();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to remove member");
		}
	}

	const openRoles = useCallback((role: UserRole) => {
		setRolesModal({ open: true, role });
		setRolesModalMounted(true);
	}, []);

	const openInvite = useCallback(() => {
		setIsInviteOpen(true);
		setInviteDrawerMounted(true);
	}, []);

	const emptyStateTitle = searchQuery.trim() ? "No matching team members" : "No team members yet";
	const emptyStateDescription = searchQuery.trim()
		? "Try adjusting your search query."
		: segment === "all"
			? "No members added yet."
			: `No ${ROLE_LABEL[segment].toLowerCase()}s yet.`;

	return (
		<>
			<WorkspaceFrame>
				{!canUpdate ? <WorkspaceReadOnlyBanner message="Read-only — you can view the team but not edit roles, profiles, or remove members." /> : null}
				<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
					<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-48">
						<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Roles</p>
						<nav aria-label="Team roles" className="-mx-1 flex-1 overflow-y-auto">
							<ul className="flex flex-col gap-0.5">
								<WorkspaceSidebarNavItem label="All members" count={segmentCounts.all} isActive={segment === "all"} onClick={() => setSegment("all")} />
								{ROLE_ORDER.map((role) => (
									<WorkspaceSidebarNavItem key={role} label={ROLE_LABEL[role]} count={segmentCounts[role]} isActive={segment === role} onClick={() => setSegment(role)} />
								))}
							</ul>
						</nav>
						<div className="mt-3 space-y-2 border-t border-[var(--color-ink-100)] pt-3">
							<Button variant="outline" size="sm" leadingIcon={<ShieldCheck size={12} />} onClick={() => openRoles("owner")} className="w-full">
								Role permissions
							</Button>
						</div>
					</aside>

					<section
						className={classNames(
							"flex w-full shrink-0 flex-col border-b border-[var(--color-ink-100)] lg:w-[min(340px,38%)] lg:max-w-sm lg:border-b-0 lg:border-r",
							activeId && "hidden lg:flex",
						)}
					>
						<WorkspacePaneHeader
							iconElement={<Users size={15} />}
							title="Team & roles"
							subtitle={`${filteredMembers.length} shown · ${segmentCounts.all} total members`}
							action={canInvite ? <WorkspacePrimaryAction label="Invite" iconElement={<Plus size={14} />} onClick={openInvite} /> : undefined}
							search={
								<>
									<WorkspaceSearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search team…" aria-label="Search team" className="w-full" />
									<div className="flex flex-wrap gap-1 lg:hidden">
										<WorkspaceFilterChip compact label="All" count={segmentCounts.all} isActive={segment === "all"} onClick={() => setSegment("all")} />
										{ROLE_ORDER.map((role) =>
											segmentCounts[role] > 0 ? (
												<WorkspaceFilterChip key={role} compact label={ROLE_LABEL[role]} count={segmentCounts[role]} isActive={segment === role} onClick={() => setSegment(role)} />
											) : null,
										)}
										<button
											type="button"
											onClick={() => openRoles("owner")}
											className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-ink-600)] hover:border-[var(--color-ink-300)] hover:text-[var(--color-ink-900)]"
										>
											<ShieldCheck size={10} /> Roles
										</button>
									</div>
								</>
							}
						/>
						<ul className="min-h-0 flex-1 overflow-y-auto">
							{filteredMembers.length === 0 ? (
								<li className="flex h-full items-center justify-center pb-8 pt-4">
									<WorkspaceEmptyPane iconElement={<Users size={22} />} title={emptyStateTitle} description={emptyStateDescription} />
								</li>
							) : (
								filteredMembers.map((member) => (
									<li key={member.id}>
										<TeamListItem
											member={member}
											isActive={member.id === activeId}
											isSelf={member.id === currentUserId}
											onSelect={() => setActiveMemberUrl(member.id)}
											onOpenRoles={() => openRoles(member.role)}
										/>
									</li>
								))
							)}
						</ul>
					</section>

					<section className={classNames("flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-canvas)]", !activeId && "hidden lg:flex")}>
						{activeId ? (
							<TeamMemberDetailPanel
								key={activeId}
								memberId={activeId}
								currentUserId={currentUserId}
								canUpdate={canUpdate}
								canRemove={canRemove}
								canViewActivity={canViewActivity}
								isCurrentUserSuperAdmin={isCurrentUserSuperAdmin}
								onBack={clearActive}
								onDelete={(member) => setToRemove(member)}
								onSaved={() => refresh()}
								onOpenRoles={(role) => openRoles(role)}
							/>
						) : (
							<WorkspaceEmptyPane
								iconElement={<Users size={22} />}
								title="Select a team member"
								description="Pick someone on the left to view their profile, change their role, reset their password, or browse what they've changed in the admin."
								action={
									canInvite ? (
										<Button variant="primary" size="sm" leadingIcon={<Plus size={14} />} onClick={openInvite}>
											Invite member
										</Button>
									) : null
								}
							/>
						)}
					</section>
				</div>
			</WorkspaceFrame>

			{inviteDrawerMounted ? (
				<TeamInviteDrawer
					isOpen={isInviteOpen}
					isCurrentUserSuperAdmin={isCurrentUserSuperAdmin}
					onClose={() => setIsInviteOpen(false)}
					onCreated={(member) => {
						setIsInviteOpen(false);
						setActiveMemberUrl(member.id);
						refresh();
					}}
				/>
			) : null}

			{rolesModalMounted ? (
				<TeamRolesModal
					isOpen={rolesModal.open}
					onClose={() => setRolesModal((current) => ({ ...current, open: false }))}
					initialRole={rolesModal.role}
					memberCounts={memberCountsByRole}
				/>
			) : null}

			<ConfirmDialog
				isOpen={toRemove !== null}
				title="Remove team member?"
				message={
					<>
						<strong>{toRemove?.name}</strong> will lose access to the admin console immediately and all their open sessions are dropped.
					</>
				}
				tone="danger"
				confirmLabel="Remove member"
				onConfirm={handleRemove}
				onCancel={() => setToRemove(null)}
			/>
		</>
	);
}

function TeamListItem({
	member,
	isActive,
	isSelf,
	onSelect,
	onOpenRoles,
}: {
	member: AdminUser;
	isActive: boolean;
	isSelf: boolean;
	onSelect: () => void;
	onOpenRoles: () => void;
}) {
	return (
		<div className={classNames("border-b border-[var(--color-ink-100)] transition-colors", isActive ? "bg-[var(--color-accent-50)]" : "hover:bg-[var(--color-canvas-deep)]")}>
			<button type="button" onClick={onSelect} className="tap flex w-full gap-3 px-3 pt-3 pb-1.5 text-left" aria-label={`Open ${member.name}'s profile`}>
				<span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-canvas-deep)] text-[11px] font-semibold text-[var(--color-ink-700)]">
					{getInitials(member.name)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex items-start justify-between gap-2">
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold text-[var(--color-ink-900)]">
								{member.name}
								{isSelf ? <span className="ml-1 text-[10px] font-medium text-[var(--color-ink-400)]">(you)</span> : null}
							</span>
							<span className="mt-0.5 block truncate text-[11px] text-[var(--color-ink-500)]">{member.email}</span>
						</span>
						{member.lastSignInAt ? (
							<span className="shrink-0 text-[10px] tabular-nums text-[var(--color-ink-400)]">{formatTimeAgo(member.lastSignInAt)}</span>
						) : (
							<span className="shrink-0 text-[10px] text-[var(--color-ink-400)]">never</span>
						)}
					</span>
				</span>
			</button>
			<div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pl-[3.25rem]">
				<button
					type="button"
					onClick={onOpenRoles}
					className="rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-700)]"
					title={`View ${ROLE_LABEL[member.role]} permissions`}
				>
					<StatusPill tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</StatusPill>
				</button>
				{member.isSuperAdmin ? <StatusPill tone="info">Super</StatusPill> : null}
				{!member.isActive ? <StatusPill tone="warn">Suspended</StatusPill> : null}
			</div>
		</div>
	);
}
