"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingCart, Trash2, Plus, Printer, MessageCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { StatusPill, type StatusTone } from "@/components/shared/StatusPill";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { TextArea } from "@/components/forms/TextArea";
import { VideoUpload } from "@/components/shared/uploads/VideoUpload";
import { useToast } from "@/components/ui/Toast";
import {
	WorkspaceDetailHeader,
	WorkspaceEmptyPane,
	WorkspaceFilterChip,
	WorkspaceFrame,
	WorkspacePaneHeader,
	WorkspaceSearchField,
	WorkspaceSidebarNavItem,
} from "@/components/shared/workspaceUi";
import { InfiniteScrollSentinel } from "@/components/shared/InfiniteScrollSentinel";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { useInfiniteList } from "@/lib/useInfiniteList";
import { useDeferredCounts } from "@/lib/useDeferredCounts";
import { useUrlParams } from "@/lib/url/useUrlParams";
import type { ListResponse } from "@/lib/api/listOptions";
import type { AdminOrdersCounts } from "@/lib/cached";
import { classNames, formatPrice, formatTimeAgo, getPaymentMethodLabel, isLoyaltyEarnCredited, ISO_DATE_LENGTH } from "@store/shared";
import { QuantityStepper, Button, ButtonLink } from "@store/ui";
import type { AdminOrder, AdminOrderEditPayload, AdminOrderSummary, AdminActivityEntry } from "@/types/models";
import { OrderEditModal } from "./OrderEditModal";
import { BankTransferConfirmPanel } from "./BankTransferConfirmPanel";
import { ActivityDetailGrid } from "@/components/shared/ActivityDetailGrid";
import { formatActivityAction } from "@/lib/activityLabels";

/** Debounce before a typed search is pushed to the URL (which refetches the seed). */
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_TONE: Record<string, StatusTone> = {
	"pending-payment": "warn",
	confirmed: "info",
	packed: "accent",
	dispatched: "accent",
	delivered: "success",
	cancelled: "danger",
	refunded: "danger",
	returned: "warn",
};

const STATUS_LABELS: Record<string, string> = {
	"pending-payment": "Awaiting payment",
	confirmed: "Confirmed",
	packed: "Order packed",
	dispatched: "Dispatched",
	delivered: "Delivered",
	cancelled: "Cancelled",
	refunded: "Refunded",
	returned: "Returned",
};

const STATUS_OPTIONS = ["pending-payment", "confirmed", "packed", "dispatched", "delivered", "cancelled", "refunded", "returned"] as const;

type StatusFilter = "all" | (typeof STATUS_OPTIONS)[number];

interface OrdersCatalogProps {
	initial: ListResponse<AdminOrderSummary>;
}

export function OrdersCatalog(props: OrdersCatalogProps) {
	return (
		<Suspense fallback={null}>
			<OrdersCatalogInner {...props} />
		</Suspense>
	);
}

function OrdersCatalogInner({ initial }: OrdersCatalogProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { startNavigation } = useNavigationTransition();
	const { replace } = useUrlParams();
	const { can } = useAdminPermissions();
	const canUpdate = can("order_update");
	const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

	const statusParam = searchParams.get("status");
	const statusFilter: StatusFilter = statusParam && (STATUS_OPTIONS as readonly string[]).includes(statusParam) ? (statusParam as StatusFilter) : "all";
	const urlQuery = searchParams.get("query") ?? "";
	const [searchInput, setSearchInput] = useState(urlQuery);

	const listParams = useMemo<Record<string, string>>(() => {
		const next: Record<string, string> = {};
		if (statusFilter !== "all") {
			next.status = statusFilter;
		}
		if (urlQuery) {
			next.query = urlQuery;
		}
		return next;
	}, [statusFilter, urlQuery]);

	const {
		items: orders,
		total,
		hasMore,
		isLoadingMore,
		hasError,
		loadMore,
	} = useInfiniteList<AdminOrderSummary>({
		endpoint: "/api/orders",
		initial,
		params: listParams,
	});

	// Collection-wide status counts + revenue stream in after first paint.
	const { counts, isLoading: countsLoading } = useDeferredCounts<AdminOrdersCounts>("/api/orders/counts", initial);

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

	const setStatusFilter = useCallback(
		(status: StatusFilter) => {
			replace({ status: status === "all" ? null : status });
		},
		[replace],
	);

	const setActiveOrderUrl = useCallback(
		(id: string | null) => {
			setActiveOrderId(id);
			if (id) {
				void apiFetch(`/api/orders/${id}/seen`, { method: "POST" }).catch(() => {});
			}
			const params = new URLSearchParams(searchParams.toString());
			if (id) {
				params.set("order", id);
			} else {
				params.delete("order");
			}
			const query = params.toString();
			const url = query ? `/orders?${query}` : "/orders";
			startNavigation(() => router.replace(url, { scroll: false }));
		},
		[router, searchParams, startNavigation],
	);

	const clearActiveOrder = useCallback(() => {
		setActiveOrderUrl(null);
	}, [setActiveOrderUrl]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			const fromUrl = searchParams.get("order");
			if (fromUrl && orders.some((order) => order.id === fromUrl)) {
				setActiveOrderId(fromUrl);
				return;
			}
			if (orders.length === 0) {
				if (activeOrderId !== null) {
					setActiveOrderUrl(null);
				}
				return;
			}
			const stillVisible = activeOrderId !== null && orders.some((order) => order.id === activeOrderId);
			if (stillVisible) return;
			const preferDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
			setActiveOrderUrl(preferDesktop ? orders[0].id : null);
		});
	}, [activeOrderId, orders, searchParams, setActiveOrderUrl]);

	return (
		<WorkspaceFrame>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-48">
					<p className="pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Status</p>
					<nav aria-label="Order status views" className="-mx-1 flex-1 overflow-y-auto">
						<ul className="flex flex-col gap-0.5">
							<WorkspaceSidebarNavItem
								label="All orders"
								count={counts ? counts.total : countsLoading ? null : undefined}
								isActive={statusFilter === "all"}
								onClick={() => setStatusFilter("all")}
							/>
							{STATUS_OPTIONS.map((status) => (
								<WorkspaceSidebarNavItem
									key={status}
									label={STATUS_LABELS[status]}
									count={counts ? (counts.byStatus[status] ?? 0) : countsLoading ? null : undefined}
									isActive={statusFilter === status}
									onClick={() => setStatusFilter(status)}
								/>
							))}
						</ul>
					</nav>
					<div className="mt-3 space-y-2 border-t border-[var(--color-ink-100)] pt-3 text-[10px] text-[var(--color-ink-500)]">
						<p>
							{counts ? (
								<span className="font-semibold text-[var(--color-ink-800)]">{counts.total}</span>
							) : countsLoading ? (
								<Skeleton shape="text" className="inline-block h-3 w-8 align-middle" />
							) : (
								<span className="font-semibold text-[var(--color-ink-800)]">—</span>
							)}{" "}
							orders
						</p>
						<p>
							{counts ? (
								<span className="font-semibold text-[var(--color-ink-800)]">{counts.pending}</span>
							) : countsLoading ? (
								<Skeleton shape="text" className="inline-block h-3 w-8 align-middle" />
							) : (
								<span className="font-semibold text-[var(--color-ink-800)]">—</span>
							)}{" "}
							awaiting payment
						</p>
						<p>
							{counts ? (
								<span className="font-semibold text-[var(--color-ink-800)]">{formatPrice(counts.netRevenueRupees)}</span>
							) : countsLoading ? (
								<Skeleton shape="text" className="inline-block h-3 w-16 align-middle" />
							) : (
								<span className="font-semibold text-[var(--color-ink-800)]">—</span>
							)}{" "}
							net revenue
						</p>
					</div>
				</aside>

				<section
					className={classNames(
						"flex w-full shrink-0 flex-col border-b border-[var(--color-ink-100)] lg:w-[min(340px,38%)] lg:max-w-sm lg:border-b-0 lg:border-r",
						activeOrderId && "hidden lg:flex",
					)}
				>
					<WorkspacePaneHeader
						iconElement={<ShoppingCart size={15} />}
						title="Orders"
						subtitle={
							<>
								{orders.length} of {total} ·{" "}
								{counts ? (
									`${formatPrice(counts.netRevenueRupees)} net revenue`
								) : countsLoading ? (
									<Skeleton shape="text" className="inline-block h-2.5 w-16 align-middle" />
								) : (
									"net revenue —"
								)}
							</>
						}
						search={
							<>
								<WorkspaceSearchField value={searchInput} onChange={setSearchInput} placeholder="Search orders…" aria-label="Search orders" className="w-full" />
								<div className="flex flex-wrap gap-1 lg:hidden" role="group" aria-label="Status filter">
									<WorkspaceFilterChip compact label="All" isActive={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
									{STATUS_OPTIONS.map((status) => (
										<WorkspaceFilterChip key={status} compact label={STATUS_LABELS[status]} isActive={statusFilter === status} onClick={() => setStatusFilter(status)} />
									))}
								</div>
							</>
						}
					/>
					<ul className="reveal-stagger min-h-0 flex-1 overflow-y-auto">
						{orders.length === 0 ? (
							<li className="px-4 py-6">
								<WorkspaceEmptyPane
									iconElement={<ShoppingCart size={22} />}
									title={urlQuery.trim() ? "No matching orders" : "No orders in this view"}
									description={urlQuery.trim() ? "Try a different search or status filter." : "Orders will appear here when customers checkout."}
								/>
							</li>
						) : (
							<>
								{orders.map((order) => (
									<li key={order.id} className="reveal">
										<OrderListItem order={order} isActive={order.id === activeOrderId} onSelect={() => setActiveOrderUrl(order.id)} />
									</li>
								))}
								<InfiniteScrollSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} hasError={hasError} onLoadMore={loadMore} />
							</>
						)}
					</ul>
				</section>

				<section className={classNames("flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-canvas)]", !activeOrderId && "hidden lg:flex")}>
					{activeOrderId ? (
						<OrderDetailPanel orderId={activeOrderId} onBack={clearActiveOrder} canUpdate={canUpdate} />
					) : (
						<WorkspaceEmptyPane
							iconElement={<ShoppingCart size={22} />}
							title="Select an order"
							description="Choose an order from the list to review items, update status, and manage fulfillment."
						/>
					)}
				</section>
			</div>
		</WorkspaceFrame>
	);
}

function OrderListItem({ order, isActive, onSelect }: { order: AdminOrderSummary; isActive: boolean; onSelect: () => void }) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={classNames(
				"tap flex w-full border-b border-[var(--color-ink-100)] px-3 py-2.5 text-left transition-colors",
				isActive ? "bg-[var(--color-accent-50)]" : "hover:bg-[var(--color-canvas-deep)]",
			)}
		>
			<span className="min-w-0 flex-1">
				<span className="flex items-center justify-between gap-2">
					<span className="truncate text-sm font-semibold text-[var(--color-ink-900)]">{order.orderNumber}</span>
					<StatusPill tone={STATUS_TONE[order.status] ?? "neutral"} className="shrink-0">
						{STATUS_LABELS[order.status] ?? order.status}
					</StatusPill>
				</span>
				<span className="mt-0.5 block truncate text-xs text-[var(--color-ink-600)]">
					{order.customer.name} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
				</span>
				<span className="mt-1 flex items-center justify-between gap-1.5">
					<span className="text-[10px] tabular-nums text-[var(--color-ink-400)]">{formatTimeAgo(order.placedAt)}</span>
					<span className="text-xs font-semibold text-[var(--color-ink-900)]">{formatPrice(order.totalRupees)}</span>
				</span>
			</span>
		</button>
	);
}

function OrderDetailPanel({ orderId, onBack, canUpdate }: { orderId: string; onBack: () => void; canUpdate: boolean }) {
	const router = useRouter();
	const toast = useToast();
	const [order, setOrder] = useState<AdminOrder | null>(null);
	const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
	const [status, setStatus] = useState("");
	const [dispatchVideoUrl, setDispatchVideoUrl] = useState("");

	const [isEditing, setIsEditing] = useState(false);
	const [isSavingStatus, setIsSavingStatus] = useState(false);
	const [isSavingEdit, setIsSavingEdit] = useState(false);

	const [confirmCancel, setConfirmCancel] = useState(false);

	const reloadActivity = useCallback(async (id: string) => {
		try {
			const res = await apiFetch<{ items: AdminActivityEntry[]; total: number }>(`/api/activity?resourceType=order&resourceId=${id}&limit=50`);
			setActivity(res.items);
		} catch {
			// Ignore
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const [fetchedOrder, fetchedActivity] = await Promise.all([
					apiFetch<AdminOrder>(`/api/orders/${orderId}`),
					apiFetch<{ items: AdminActivityEntry[]; total: number }>(`/api/activity?resourceType=order&resourceId=${orderId}&limit=50`).catch(() => ({ items: [], total: 0 })),
				]);
				if (cancelled) return;
				setOrder(fetchedOrder);
				setActivity(fetchedActivity?.items ?? []);
				setStatus(fetchedOrder?.status ?? "");
				setDispatchVideoUrl(fetchedOrder?.dispatchVideoUrl ?? "");
			} catch (error) {
				if (!cancelled) {
					toast.danger(error instanceof Error ? error.message : "Failed to load order");
					onBack();
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [orderId, onBack, toast]);

	async function handleStatusChange(newStatus: string) {
		if (!order) return;
		if (newStatus === "packed" && !dispatchVideoUrl.trim()) {
			setStatus("packed");
			toast.info("Please enter a dispatch video URL below to complete packing.");
			return;
		}

		setIsSavingStatus(true);
		const prevStatus = status;
		setStatus(newStatus);

		try {
			const updated = await apiFetch<AdminOrder>(`/api/orders/${order.id}`, {
				method: "PUT",
				json: { status: newStatus },
			});
			setOrder(updated);
			void reloadActivity(order.id);
			toast.success("Order status updated");
			router.refresh();
		} catch (error) {
			setStatus(prevStatus);
			toast.danger(error instanceof Error ? error.message : "Failed to update status");
		} finally {
			setIsSavingStatus(false);
		}
	}

	async function handleDispatchVideoSave(url: string) {
		setDispatchVideoUrl(url);
		if (!url.trim() || !order) return;

		setIsSavingStatus(true);
		try {
			const updated = await apiFetch<AdminOrder>(`/api/orders/${order.id}`, {
				method: "PUT",
				json: {
					status: "packed",
					dispatchVideoUrl: url,
				},
			});
			setOrder(updated);
			setStatus("packed");
			void reloadActivity(order.id);
			toast.success("Dispatch video saved and order packed");
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to save video");
		} finally {
			setIsSavingStatus(false);
		}
	}

	async function handleEditSave(payload: AdminOrderEditPayload) {
		if (!order || isSavingEdit) return;
		setIsSavingEdit(true);
		try {
			const updated = await apiFetch<AdminOrder>(`/api/orders/${order.id}`, {
				method: "PUT",
				json: { ...payload, status },
			});
			setOrder(updated);
			setIsEditing(false);
			void reloadActivity(order.id);
			toast.success("Order details updated");
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to update order");
			throw error;
		} finally {
			setIsSavingEdit(false);
		}
	}

	if (!order) {
		return <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-ink-500)]">Loading order…</div>;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col relative">
			{!canUpdate ? (
				<p className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-2 text-center text-[11px] text-[var(--color-ink-600)]">
					Read-only — you can view orders but not change status.
				</p>
			) : null}
			<WorkspaceDetailHeader
				onBack={onBack}
				backLabel="Back to orders"
				title={order.orderNumber}
				subtitle={`${new Date(order.placedAt).toLocaleString()} · ${getPaymentMethodLabel(order.payment)} · ${order.delivery}`}
				badge={<StatusPill tone={STATUS_TONE[order.status] ?? "neutral"}>{STATUS_LABELS[order.status] ?? order.status}</StatusPill>}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
				<div className="space-y-5">
					<section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<OrderStatusStepper status={status} onChange={handleStatusChange} disabled={!canUpdate || isSavingStatus} />

						{status === "packed" && (
							<VideoUpload
								value={dispatchVideoUrl}
								onChange={handleDispatchVideoSave}
								subjectKind="orders"
								subjectId={`dispatch-${order.id}`}
								label="Dispatch video"
								hint="Upload or paste a YouTube URL of the order being packed. Saving updates the order."
							/>
						)}
					</section>

					{order.payment === "bank-transfer" && order.status === "pending-payment" ? (
						<BankTransferConfirmPanel
							orderNumber={order.orderNumber}
							totalRupees={order.totals.totalRupees}
							bankTransferDetails={order.bankTransferDetails}
						/>
					) : null}

					<section className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 relative">
						<div className="absolute top-4 right-4">
							{canUpdate && order.status === "pending-payment" ? (
								<Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
									Edit order
								</Button>
							) : null}
						</div>
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Customer</p>
							<p className="mt-1 text-sm font-semibold text-[var(--color-ink-900)]">{order.customer.name}</p>
							<p className="text-xs text-[var(--color-ink-600)]">
								{order.customer.city} · {order.customer.phoneNumber}
							</p>
						</div>
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Loyalty</p>
							<p className="mt-1 text-sm text-[var(--color-ink-800)]">
								{order.pointsEarned > 0
									? isLoyaltyEarnCredited(order.status)
										? `+${order.pointsEarned} earned`
										: `+${order.pointsEarned} when delivered`
									: "No points on this order"}
								{order.pointsRedeemed > 0 ? ` · ${order.pointsRedeemed} redeemed` : ""}
							</p>
						</div>
					</section>

					{order.address ? (
						<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
							<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] mb-3">Delivery address</p>
							<p className="text-sm font-medium text-[var(--color-ink-900)]">
								{order.address?.recipientName} · {order.address?.phoneNumber}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-600)]">
								{[order.address?.street, order.address?.area, order.address?.city, order.address?.postalCode].filter(Boolean).join(", ")}
							</p>
						</section>
					) : null}

					<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Line items</p>
						<div className="mt-2 overflow-x-auto">
							<table className="w-full text-left text-sm text-[var(--color-ink-800)]">
								<thead>
									<tr className="border-b border-[var(--color-ink-100)] text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
										<th className="pb-2 font-semibold">Product</th>
										<th className="pb-2 text-right font-semibold">Qty</th>
										<th className="pb-2 text-right font-semibold">Unit Price</th>
										<th className="pb-2 text-right font-semibold">Total</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-[var(--color-ink-100)]">
									{order.items.map((line) => (
										<tr key={line.id}>
											<td className="py-2 pr-2">
												<div className="font-semibold text-[var(--color-ink-900)]">{line.productName}</div>
												<div className="text-xs text-[var(--color-ink-500)]">{line.variantSummary}</div>
											</td>
											<td className="py-2 pl-2 text-right">{line.quantity}</td>
											<td className="py-2 pl-2 text-right">{formatPrice(line.unitPriceRupees)}</td>
											<td className="py-2 pl-2 text-right font-semibold">{formatPrice(line.unitPriceRupees * line.quantity)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="mt-3 space-y-1 border-t border-[var(--color-ink-100)] pt-3 text-sm">
							<TotalRow label="Subtotal" value={formatPrice(order.totals.subtotalRupees)} />
							<TotalRow label="Shipping" value={formatPrice(order.totals.shippingRupees)} />
							{order.totals.discountRupees > 0 ? <TotalRow label="Discount" value={`-${formatPrice(order.totals.discountRupees)}`} /> : null}
							{(order.totals.paymentSurchargeRupees ?? 0) > 0 ? (
								<TotalRow label="Cash handling" value={`+${formatPrice(order.totals.paymentSurchargeRupees!)}`} />
							) : null}
							<TotalRow label="Total" value={formatPrice(order.totals.totalRupees)} strong />
						</div>
					</section>

					{activity.length > 0 ? (
						<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
							<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] mb-3">Timeline History</p>
							<ol className="space-y-3">
								{activity.map((entry) => (
									<li key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2 text-sm">
										<div className="mb-1 flex items-center justify-between">
											<span className="font-medium text-[var(--color-ink-900)]">{formatActivityAction(entry.action)}</span>
											<span className="text-xs text-[var(--color-ink-500)]">{new Date(entry.createdAt).toLocaleString()}</span>
										</div>
										{entry.actorName ? (
											<p className="text-xs text-[var(--color-ink-600)] mb-1">
												By {entry.actorName} ({entry.actorRole})
											</p>
										) : null}
										{entry.detail ? (
											<div className="mt-2 text-xs">
												<ActivityDetailGrid detail={entry.detail} />
											</div>
										) : null}
									</li>
								))}
							</ol>
						</section>
					) : null}
				</div>
			</div>

			<footer className="shrink-0 border-t border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-1.5">
						{canUpdate ? (
							<Button
								variant="outline"
								size="sm"
								leadingIcon={<Printer size={12} />}
								onClick={() => window.open(`/orders/${order.id}/invoice`, "_blank")}
								title="Print professional invoice"
							>
								Print invoice
							</Button>
						) : null}
						<Button
							variant="outline"
							size="sm"
							leadingIcon={<MessageCircle size={12} />}
							onClick={() => {
								const num = order.customer.phoneNumber.replace(/\D/g, "");
								const waNum = num.startsWith("0") ? "92" + num.slice(1) : num;
								window.open(`https://wa.me/${waNum}`, "_blank");
							}}
						>
							WhatsApp Customer
						</Button>
						{order.customer.id ? (
							<ButtonLink variant="outline" size="sm" href={`/customers?customer=${order.customer.id}`}>
								View customer
							</ButtonLink>
						) : null}
					</div>
					{canUpdate && !["cancelled", "refunded", "returned", "delivered"].includes(order.status) ? (
						<Button variant="danger" size="sm" type="button" onClick={() => setConfirmCancel(true)} isLoading={isSavingStatus} leadingIcon={<Trash2 size={12} />}>
							Cancel order
						</Button>
					) : null}
				</div>
			</footer>

			{isEditing && (
				<OrderEditModal
					isOpen={isEditing}
					onClose={() => setIsEditing(false)}
					order={order}
					onSave={async (payload) => {
						await handleEditSave(payload);
					}}
					isSaving={isSavingEdit}
				/>
			)}

			<ConfirmDialog
				isOpen={confirmCancel}
				title="Cancel order?"
				message={
					<>
						Cancel <strong>{order.orderNumber}</strong>? Reserved stock will be released and loyalty points will be reversed.
					</>
				}
				tone="danger"
				confirmLabel="Cancel order"
				onConfirm={() => {
					setConfirmCancel(false);
					void handleStatusChange("cancelled");
				}}
				onCancel={() => setConfirmCancel(false)}
			/>
		</div>
	);
}
function getTerminalStepClassName(isActive: boolean) {
	const base = "rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] font-semibold transition-colors";
	const stateClass = isActive
		? "border-[var(--color-danger-500)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
		: "border-[var(--color-ink-200)] bg-transparent text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]";
	return classNames(base, stateClass);
}

function getStepClassName(isActive: boolean, isPast: boolean, isClickable: boolean) {
	const base = "relative z-10 flex h-7 items-center justify-center whitespace-nowrap rounded-full px-3 text-[11px] font-semibold transition-all";
	const stateClass = isActive
		? "bg-[var(--color-accent-500)] text-[var(--color-ink-900)] shadow-sm ring-4 ring-[var(--color-surface)]"
		: isPast
			? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] ring-4 ring-[var(--color-surface)]"
			: "bg-[var(--color-ink-100)] text-[var(--color-ink-500)] ring-4 ring-[var(--color-surface)]";
	const hoverClass = isClickable && !isActive ? "hover:scale-105 cursor-pointer" : "";
	return classNames(base, stateClass, hoverClass);
}

function OrderStatusStepper({ status, onChange, disabled }: { status: string; onChange: (s: string) => void; disabled: boolean }) {
	const HAPPY_PATH = ["pending-payment", "confirmed", "packed", "dispatched", "delivered"];
	const TERMINAL_STATES = ["cancelled", "refunded", "returned"];
	const currentIndex = HAPPY_PATH.indexOf(status);

	return (
		<div className="space-y-4">
			<div className="flex w-full items-center overflow-x-auto pb-2">
				{HAPPY_PATH.map((step, index) => {
					const isActive = status === step;
					const isPast = currentIndex > index && !TERMINAL_STATES.includes(status);
					const isClickable = !disabled && (index === currentIndex || index === currentIndex + 1 || (index === currentIndex - 1 && currentIndex < 3));

					return (
						<div key={step} className="flex flex-1 items-center last:flex-none">
							<button type="button" disabled={!isClickable} onClick={() => onChange(step)} className={getStepClassName(isActive, isPast, isClickable)}>
								{index === currentIndex + 1 && !TERMINAL_STATES.includes(status) && (
									<span className="absolute -right-0.5 -top-0.5 flex size-2.5">
										<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent-500)] opacity-75"></span>
										<span className="relative inline-flex size-2.5 rounded-full border border-white bg-[var(--color-accent-700)]"></span>
									</span>
								)}
								{STATUS_LABELS[step]}
							</button>
							{index < HAPPY_PATH.length - 1 && (
								<div className={classNames("h-0.5 flex-1 min-w-[20px] -mx-1", isPast ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-ink-100)]")} />
							)}
						</div>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-ink-100)] pt-3">
				<span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Other actions:</span>
				{TERMINAL_STATES.map((step) => (
					<button key={step} type="button" disabled={disabled} onClick={() => onChange(step)} className={getTerminalStepClassName(status === step)}>
						{STATUS_LABELS[step]}
					</button>
				))}
			</div>
		</div>
	);
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
	return (
		<div className="flex items-baseline justify-between gap-2">
			<span className="text-[var(--color-ink-500)]">{label}</span>
			<span className={strong ? "text-base font-semibold text-[var(--color-ink-900)]" : "font-medium text-[var(--color-ink-800)]"}>{value}</span>
		</div>
	);
}
