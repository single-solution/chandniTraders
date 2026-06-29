"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { StatusPill } from "@/components/shared/StatusPill";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { WorkspaceEmptyPane, WorkspaceFrame, WorkspacePaneHeader, WorkspaceSearchField } from "@/components/shared/workspaceUi";
import { InfiniteScrollSentinel } from "@/components/shared/InfiniteScrollSentinel";
import { apiFetch } from "@/lib/api";
import { useInfiniteList } from "@/lib/useInfiniteList";
import { useUrlParams } from "@/lib/url/useUrlParams";
import { getInitials } from "@/lib/initials";
import { classNames, formatTimeAgo } from "@store/shared";
import type { ListResponse } from "@/lib/api/listOptions";
import type { AdminInquirySummary, AdminUser } from "@/types/models";
import type { InquiriesPageAccess } from "@/app/inquiries/page";
import type { PermissionKey } from "@/lib/permissionsCatalog";

import { InquiryConversationPanel } from "./inquiryConversationPanel";
import { STATUS_LABELS, STATUS_TONE } from "./inquiriesStatus";

/** Debounce before a typed search is pushed to the URL (which refetches the seed). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Admin inquiries inbox — list, read, reply, assign, and resolve customer inquiries.
 * Actions are gated by role permissions (`inquiry_view`, `inquiry_reply`, `inquiry_manage`).
 */

interface InquiriesProps {
	initial: ListResponse<AdminInquirySummary>;
	access: InquiriesPageAccess;
}

interface TeamListResponse {
	items: AdminUser[];
}

function accessFlags(permissions: PermissionKey[]) {
	const set = new Set(permissions);
	return {
		canReply: set.has("inquiry_reply"),
		canManage: set.has("inquiry_manage"),
		canViewTeam: set.has("team_view"),
	};
}

export function Inquiries(props: InquiriesProps) {
	return (
		<Suspense fallback={null}>
			<InquiriesInner {...props} />
		</Suspense>
	);
}

function InquiriesInner({ initial, access }: InquiriesProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { startNavigation } = useNavigationTransition();
	const { replace } = useUrlParams();
	const flags = accessFlags(access.permissions);
	const [teamById, setTeamById] = useState<Map<string, string>>(new Map());
	const [activeInquiryId, setActiveInquiryId] = useState<string | null>(null);

	const urlQuery = searchParams.get("query") ?? "";
	const [searchInput, setSearchInput] = useState(urlQuery);

	const listParams = useMemo<Record<string, string>>(() => {
		const next: Record<string, string> = {};
		if (urlQuery) {
			next.query = urlQuery;
		}
		return next;
	}, [urlQuery]);

	const {
		items: inquiries,
		total,
		hasMore,
		isLoadingMore,
		hasError,
		loadMore,
		patchItem,
		removeItem,
	} = useInfiniteList<AdminInquirySummary>({
		endpoint: "/api/inquiries",
		initial,
		params: listParams,
	});

	// Debounced search → URL → SSR seed refetch (single source of truth).
	useEffect(() => {
		if (searchInput === urlQuery) {
			return;
		}
		const id = setTimeout(() => {
			replace({ query: searchInput || null });
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [searchInput, urlQuery, replace]);

	const setActiveInquiryUrl = useCallback(
		(id: string | null) => {
			setActiveInquiryId(id);
			const params = new URLSearchParams(searchParams.toString());
			if (id) {
				params.set("inquiry", id);
			} else {
				params.delete("inquiry");
			}
			const query = params.toString();
			const url = query ? `/inquiries?${query}` : "/inquiries";
			startNavigation(() => router.replace(url, { scroll: false }));
		},
		[router, searchParams, startNavigation],
	);

	const clearActiveInquiry = useCallback(() => {
		setActiveInquiryUrl(null);
	}, [setActiveInquiryUrl]);

	// Optimistic: clear the unread badge the moment a thread is opened/read.
	const handleInquiryRead = useCallback(
		(id: string) => {
			patchItem(id, { unreadByTeam: 0 });
		},
		[patchItem],
	);

	// Optimistic: reflect status/assignment/preview changes in the row in place.
	const refreshInquiryInList = useCallback(
		(updated: AdminInquirySummary) => {
			patchItem(updated.id, updated);
		},
		[patchItem],
	);

	useEffect(() => {
		if (!flags.canManage && !flags.canViewTeam) {
			return;
		}
		let cancelled = false;
		async function loadTeam() {
			try {
				const data = await apiFetch<TeamListResponse>("/api/team?limit=200");
				if (cancelled) return;
				setTeamById(new Map(data.items.map((member) => [member.id, member.name])));
			} catch {
				// ignore — assignee names fall back to "Assigned"
			}
		}
		void loadTeam();
		return () => {
			cancelled = true;
		};
	}, [flags.canManage, flags.canViewTeam]);

	function assigneeLabel(userId?: string): string {
		if (!userId) return "Unassigned";
		return teamById.get(userId) ?? "Assigned";
	}

	useEffect(() => {
		scheduleStateUpdate(() => {
			const fromUrl = searchParams.get("inquiry");
			if (fromUrl && inquiries.some((inquiry) => inquiry.id === fromUrl)) {
				setActiveInquiryId(fromUrl);
				return;
			}
			if (inquiries.length === 0) {
				if (activeInquiryId !== null) {
					setActiveInquiryUrl(null);
				}
				return;
			}
			const activeStillVisible = activeInquiryId !== null && inquiries.some((inquiry) => inquiry.id === activeInquiryId);
			if (activeStillVisible) {
				return;
			}
			const preferDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
			setActiveInquiryUrl(preferDesktop ? inquiries[0].id : null);
		});
	}, [activeInquiryId, inquiries, searchParams, setActiveInquiryUrl]);

	return (
		<WorkspaceFrame>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<ThreadListPane
					inquiries={inquiries}
					total={total}
					activeId={activeInquiryId}
					searchQuery={searchInput}
					onSearchChange={setSearchInput}
					onSelect={(id) => setActiveInquiryUrl(id)}
					assigneeLabel={assigneeLabel}
					hiddenOnMobile={Boolean(activeInquiryId)}
					hasMore={hasMore}
					isLoadingMore={isLoadingMore}
					hasError={hasError}
					onLoadMore={loadMore}
				/>

				<section className={classNames("flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-canvas)]", !activeInquiryId && "hidden lg:flex")}>
					{activeInquiryId ? (
						<InquiryConversationPanel
							inquiryId={activeInquiryId}
							actorId={access.actorId}
							actorName={access.actorName}
							canReply={flags.canReply}
							canManage={flags.canManage}
							teamMembers={flags.canManage && flags.canViewTeam ? [...teamById.entries()].map(([id, name]) => ({ id, name })) : []}
							assigneeLabel={assigneeLabel}
							onBack={clearActiveInquiry}
							onRead={handleInquiryRead}
							onThreadUpdated={refreshInquiryInList}
							onDeleted={() => {
								if (activeInquiryId) {
									removeItem(activeInquiryId);
								}
								setActiveInquiryUrl(null);
							}}
							onCallTapped={(phoneNumber: string) => {
								window.location.href = `tel:${phoneNumber.replace(/\s+/g, "")}`;
							}}
						/>
					) : (
						<WorkspaceEmptyPane
							iconElement={<MessageSquare size={22} />}
							title="Select a conversation"
							description="Choose a thread on the left to read messages and reply to customers."
						/>
					)}
				</section>
			</div>
		</WorkspaceFrame>
	);
}

interface ThreadListPaneProps {
	inquiries: AdminInquirySummary[];
	total: number;
	activeId: string | null;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	onSelect: (id: string) => void;
	assigneeLabel: (userId?: string) => string;
	hiddenOnMobile: boolean;
	hasMore: boolean;
	isLoadingMore: boolean;
	hasError: boolean;
	onLoadMore: () => void;
}

function ThreadListPane({
	inquiries,
	total,
	activeId,
	searchQuery,
	onSearchChange,
	onSelect,
	assigneeLabel,
	hiddenOnMobile,
	hasMore,
	isLoadingMore,
	hasError,
	onLoadMore,
}: ThreadListPaneProps) {
	return (
		<aside
			className={classNames(
				"flex w-full shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-surface)] lg:w-[min(340px,38%)] lg:max-w-sm lg:border-b-0 lg:border-r",
				hiddenOnMobile && "hidden lg:flex",
			)}
		>
			<WorkspacePaneHeader
				iconElement={<MessageSquare size={15} />}
				title="Inquiries"
				subtitle={`${inquiries.length} of ${total} conversation${total === 1 ? "" : "s"} · from storefront chat`}
				search={<WorkspaceSearchField value={searchQuery} onChange={onSearchChange} placeholder="Search conversations…" aria-label="Search conversations" className="w-full" />}
			/>

			<ul className="reveal-stagger min-h-0 flex-1 overflow-y-auto">
				{inquiries.length === 0 ? (
					<li className="px-4 py-8 text-center text-xs text-[var(--color-ink-500)]">
						{searchQuery.trim() ? "No conversations match your search." : "No conversations yet. Threads appear when customers use the storefront chat widget."}
					</li>
				) : (
					<>
						{inquiries.map((inquiry) => (
							<li key={inquiry.id} className="reveal">
								<ThreadListItem inquiry={inquiry} isActive={inquiry.id === activeId} assigneeLabel={assigneeLabel} onSelect={() => onSelect(inquiry.id)} />
							</li>
						))}
						<InfiniteScrollSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} hasError={hasError} onLoadMore={onLoadMore} />
					</>
				)}
			</ul>
		</aside>
	);
}

function ThreadListItem({
	inquiry,
	isActive,
	assigneeLabel,
	onSelect,
}: {
	inquiry: AdminInquirySummary;
	isActive: boolean;
	assigneeLabel: (userId?: string) => string;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={classNames(
				"tap flex w-full gap-3 border-b border-l-2 border-[var(--color-ink-100)] px-3 py-3 text-left transition-colors",
				inquiry.assistantPaused
					? inquiry.assistantPauseReason === "manual"
						? "border-l-[var(--color-warn-600)]"
						: "border-l-[var(--color-danger-600)]"
					: "border-l-transparent",
				isActive ? "bg-[var(--color-accent-50)]" : "hover:bg-[var(--color-canvas-deep)]",
			)}
		>
			<span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-canvas-deep)] text-[11px] font-semibold text-[var(--color-ink-700)]">
				{getInitials(inquiry.customerName)}
				{inquiry.assistantPaused ? (
					<span
						className={classNames(
							"absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full text-white ring-2 ring-[var(--color-surface)]",
							inquiry.assistantPauseReason === "manual" ? "bg-[var(--color-warn-600)]" : "bg-[var(--color-danger-600)]",
						)}
						aria-hidden
					>
						<AlertTriangle size={9} />
					</span>
				) : null}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-start justify-between gap-2">
					<span className="truncate text-sm font-semibold text-[var(--color-ink-900)]">{inquiry.customerName}</span>
					<span className="shrink-0 text-[10px] tabular-nums text-[var(--color-ink-400)]">{formatTimeAgo(inquiry.lastMessageAt)}</span>
				</span>
				<span className="mt-0.5 block truncate text-xs text-[var(--color-ink-600)]">{inquiry.lastMessagePreview || "No messages yet"}</span>
				<span className="mt-1.5 flex flex-wrap items-center gap-1.5">
					{inquiry.assistantPaused ? (
						<span
							className={classNames(
								"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white",
								inquiry.assistantPauseReason === "manual" ? "bg-[var(--color-warn-700)]" : "bg-[var(--color-danger-600)]",
							)}
						>
							<AlertTriangle size={10} />
							{inquiry.assistantPauseReason === "manual" ? "Bot off" : "Escalated"}
						</span>
					) : null}
					<StatusPill tone={STATUS_TONE[inquiry.status]}>{STATUS_LABELS[inquiry.status]}</StatusPill>
					<span className="text-[10px] text-[var(--color-ink-500)]">{assigneeLabel(inquiry.assignedToUserId)}</span>
					{inquiry.unreadByTeam > 0 ? (
						<span className="rounded-full bg-[var(--color-danger-600)] px-1.5 py-0.5 text-[9px] font-semibold text-white">{inquiry.unreadByTeam}</span>
					) : null}
				</span>
			</span>
		</button>
	);
}
