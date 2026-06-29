"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, UserCircle } from "lucide-react";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
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
} from "@/components/shared/workspaceUi";
import { CustomerCreateDrawer } from "./CustomerCreateDrawer";
import { CustomerDetailPanel } from "./CustomerDetailPanel";
import { InfiniteScrollSentinel } from "@/components/shared/InfiniteScrollSentinel";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { useInfiniteList } from "@/lib/useInfiniteList";
import { useDeferredCounts } from "@/lib/useDeferredCounts";
import { useUrlParams } from "@/lib/url/useUrlParams";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { pingNavigationProgress, useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { getInitials } from "@/lib/initials";
import { classNames, formatPrice, formatTimeAgo } from "@store/shared";
import type { ListResponse } from "@/lib/api/listOptions";
import type { CustomerListCounts, CustomerSegment } from "@/lib/server/customerListQuery";
import type { AdminCustomerSummary } from "@/types/models";

/** Debounce before a typed search is pushed to the URL (which refetches the seed). */
const SEARCH_DEBOUNCE_MS = 300;

interface CustomersCatalogProps {
	initial: ListResponse<AdminCustomerSummary>;
	programmeRupeesPerPoint: number;
}

export function CustomersCatalog(props: CustomersCatalogProps) {
	return (
		<Suspense fallback={null}>
			<CustomersCatalogInner {...props} />
		</Suspense>
	);
}

function CustomersCatalogInner({ initial, programmeRupeesPerPoint }: CustomersCatalogProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { startNavigation } = useNavigationTransition();
	const { replace } = useUrlParams();
	const toast = useToast();
	const { can } = useAdminPermissions();

	const [activeId, setActiveId] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<AdminCustomerSummary | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const canManage = can("customer_manage");
	const canCreate = can("customer_update");
	const canAdjustLoyalty = can("loyalty_manage") || can("customer_manage");

	const segmentParam = searchParams.get("segment");
	const segment: CustomerSegment = segmentParam === "loyalty" || segmentParam === "active" ? segmentParam : "all";
	const urlQuery = searchParams.get("query") ?? "";
	const [searchInput, setSearchInput] = useState(urlQuery);

	const listParams = useMemo<Record<string, string>>(() => {
		const next: Record<string, string> = {};
		if (segment !== "all") {
			next.segment = segment;
		}
		if (urlQuery) {
			next.query = urlQuery;
		}
		return next;
	}, [segment, urlQuery]);

	const {
		items: customers,
		total,
		hasMore,
		isLoadingMore,
		hasError,
		loadMore,
		removeItem,
	} = useInfiniteList<AdminCustomerSummary>({
		endpoint: "/api/customers",
		initial,
		params: listParams,
	});

	// Collection-wide segment counts + loyalty total stream in after first paint.
	const { counts, isLoading: countsLoading } = useDeferredCounts<CustomerListCounts>("/api/customers/counts", initial);

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

	const setSegment = useCallback(
		(next: CustomerSegment) => {
			replace({ segment: next === "all" ? null : next });
		},
		[replace],
	);

	const setActiveCustomerUrl = useCallback(
		(id: string | null) => {
			setActiveId(id);
			if (id) {
				void apiFetch(`/api/customers/${id}/seen`, { method: "POST" }).catch(() => {});
			}
			const params = new URLSearchParams(searchParams.toString());
			if (id) {
				params.set("customer", id);
			} else {
				params.delete("customer");
			}
			const query = params.toString();
			const url = query ? `/customers?${query}` : "/customers";
			startNavigation(() => router.replace(url, { scroll: false }));
		},
		[router, searchParams, startNavigation],
	);

	const clearActiveCustomer = useCallback(() => {
		setActiveCustomerUrl(null);
	}, [setActiveCustomerUrl]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			const fromUrl = searchParams.get("customer");
			if (fromUrl && customers.some((row) => row.id === fromUrl)) {
				setActiveId(fromUrl);
				return;
			}
			if (customers.length === 0) {
				if (activeId !== null) {
					setActiveCustomerUrl(null);
				}
				return;
			}
			const stillVisible = activeId !== null && customers.some((row) => row.id === activeId);
			if (stillVisible) return;
			const preferDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
			setActiveCustomerUrl(preferDesktop ? customers[0].id : null);
		});
	}, [activeId, customers, searchParams, setActiveCustomerUrl]);

	function refresh() {
		pingNavigationProgress();
		router.refresh();
	}

	async function handleDelete() {
		if (!toDelete) return;
		try {
			await apiFetch(`/api/customers/${toDelete.id}`, { method: "DELETE" });
			toast.warn(`"${toDelete.name}" deleted`);
			removeItem(toDelete.id);
			setToDelete(null);
			setActiveCustomerUrl(null);
			refresh();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to delete customer");
		}
	}

	return (
		<>
			<WorkspaceFrame>
				{!canManage ? <WorkspaceReadOnlyBanner message="Read-only — you can view customers but not edit profiles, addresses, or loyalty." /> : null}
				<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
					<section
						className={classNames(
							"flex w-full shrink-0 flex-col border-b border-[var(--color-ink-100)] lg:w-[min(360px,40%)] lg:max-w-sm lg:border-b-0 lg:border-r",
							activeId && "hidden lg:flex",
						)}
					>
						<WorkspacePaneHeader
							iconElement={<UserCircle size={15} />}
							title="Customers"
							subtitle={
								<>
									{customers.length} of {total} · website sign-up ·{" "}
									{counts ? (
										`${formatPrice(counts.totalLoyaltyBalance * programmeRupeesPerPoint)} loyalty`
									) : countsLoading ? (
										<Skeleton shape="text" className="inline-block h-2.5 w-14 align-middle" />
									) : (
										"loyalty —"
									)}
								</>
							}
							action={canCreate ? <WorkspacePrimaryAction label="New customer" iconElement={<Plus size={14} />} onClick={() => setIsCreateOpen(true)} /> : undefined}
							search={
								<>
									<WorkspaceSearchField value={searchInput} onChange={setSearchInput} placeholder="Search customers…" aria-label="Search customers" className="w-full" />
									<div className="flex flex-wrap gap-1">
										<WorkspaceFilterChip
											compact
											label="All"
											count={counts ? counts.all : countsLoading ? null : undefined}
											isActive={segment === "all"}
											onClick={() => setSegment("all")}
										/>
										<WorkspaceFilterChip
											compact
											label="Loyalty"
											count={counts ? counts.loyalty : countsLoading ? null : undefined}
											isActive={segment === "loyalty"}
											onClick={() => setSegment("loyalty")}
										/>
										<WorkspaceFilterChip
											compact
											label="With orders"
											count={counts ? counts.active : countsLoading ? null : undefined}
											isActive={segment === "active"}
											onClick={() => setSegment("active")}
										/>
									</div>
								</>
							}
						/>
						<ul className="reveal-stagger min-h-0 flex-1 overflow-y-auto">
							{customers.length === 0 ? (
								<li className="px-4 py-8 text-center text-xs leading-relaxed text-[var(--color-ink-500)]">
									{urlQuery.trim()
										? "No customers match your search."
										: segment === "all"
											? "No customers yet. Records appear when someone signs in with OTP or checks out on the storefront."
											: "No customers in this segment."}
								</li>
							) : (
								<>
									{customers.map((customer) => (
										<li key={customer.id} className="reveal">
											<CustomerListItem customer={customer} isActive={customer.id === activeId} onSelect={() => setActiveCustomerUrl(customer.id)} />
										</li>
									))}
									<InfiniteScrollSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} hasError={hasError} onLoadMore={loadMore} />
								</>
							)}
						</ul>
					</section>

					<section className={classNames("flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-canvas)]", !activeId && "hidden lg:flex")}>
						{activeId ? (
							<CustomerDetailPanel
								customerId={activeId}
								programmeRupeesPerPoint={programmeRupeesPerPoint}
								canManage={canManage}
								canIssueCode={canCreate}
								canAdjustLoyalty={canAdjustLoyalty}
								canViewInquiries={can("inquiry_view")}
								canViewActivity={can("activity_view")}
								onBack={clearActiveCustomer}
								onDelete={(summary) => setToDelete(summary)}
								onSaved={refresh}
							/>
						) : (
							<WorkspaceEmptyPane
								iconElement={<UserCircle size={22} />}
								title="Select a customer"
								description="Customers register on the website (OTP sign-in or checkout). Use this workspace to view orders, adjust loyalty, and add internal notes."
							/>
						)}
					</section>
				</div>
			</WorkspaceFrame>

			{canCreate ? (
				<CustomerCreateDrawer
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onCreated={(created) => {
						setIsCreateOpen(false);
						setActiveCustomerUrl(created.id);
						refresh();
					}}
				/>
			) : null}

			<ConfirmDialog
				isOpen={toDelete !== null}
				title="Delete customer?"
				message={
					<>
						Deleting <strong>{toDelete?.name}</strong> removes their record permanently. Customers with orders cannot be deleted.
					</>
				}
				tone="danger"
				confirmLabel="Delete customer"
				onConfirm={handleDelete}
				onCancel={() => setToDelete(null)}
			/>
		</>
	);
}

function CustomerListItem({ customer, isActive, onSelect }: { customer: AdminCustomerSummary; isActive: boolean; onSelect: () => void }) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={classNames(
				"tap flex w-full gap-3 border-b border-[var(--color-ink-100)] px-3 py-3 text-left transition-colors",
				isActive ? "bg-[var(--color-accent-50)]" : "hover:bg-[var(--color-canvas-deep)]",
			)}
		>
			<span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-canvas-deep)] text-[11px] font-semibold text-[var(--color-ink-700)]">
				{getInitials(customer.name)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-start justify-between gap-2">
					<span className="truncate text-sm font-semibold text-[var(--color-ink-900)]">{customer.name}</span>
					{customer.lastOrderAt ? <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-ink-400)]">{formatTimeAgo(customer.lastOrderAt)}</span> : null}
				</span>
				<span className="mt-0.5 block truncate text-xs text-[var(--color-ink-600)]">
					{customer.city} · {customer.phoneNumber}
				</span>
				<span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
					{customer.isLoyaltyMember ? <StatusPill tone="accent">Loyalty</StatusPill> : null}
					<span className="font-semibold text-[var(--color-ink-800)]">
						{customer.orderCount} order{customer.orderCount === 1 ? "" : "s"}
					</span>
					{customer.loyaltyBalance > 0 ? <span className="text-[var(--color-accent-700)]">{customer.loyaltyBalance.toLocaleString()} pts</span> : null}
				</span>
			</span>
		</button>
	);
}
