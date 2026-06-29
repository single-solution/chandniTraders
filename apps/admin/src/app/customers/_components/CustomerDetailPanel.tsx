"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, KeyRound, Mail, MessageSquare, Phone, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@store/ui";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { StatusPill, type StatusTone } from "@/components/shared/StatusPill";
import { TabList } from "@/components/ui/Tabs";
import { TextField } from "@/components/forms/TextField";
import { TextArea } from "@/components/forms/TextArea";
import { SelectField } from "@/components/forms/SelectField";
import { Switch } from "@/components/forms/Switch";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api";
import { getInitials } from "@/lib/initials";
import { formatActivityAction, resolveResourceUrl } from "@/lib/activityLabels";
import { FIELD_LIMITS, formatPrice, formatTimeAgo } from "@store/shared";
import type { AdminActivityEntry, AdminCustomer, AdminCustomerSummary, AdminInquirySummary, AdminLoyaltyAccount, AdminOrderSummary } from "@/types/models";
import { WorkspaceDetailHeader } from "@/components/shared/workspaceUi";
import { CustomerAccessCodeDialog } from "./CustomerAccessCodeDialog";
import { CustomerAddressesSection } from "./CustomerAddressesSection";
import { CustomerErrorBanner, CustomerStatCard, type CustomerDetailTab } from "./customerDetailUi";
import { ActivityDetailGrid } from "@/components/shared/ActivityDetailGrid";

const EMAIL_MAX_CHARS = 320;
const RECENT_TRANSACTIONS_PREVIEW = 8;
const ORDER_REF_INPUT_MAX = 32;

const ORDER_STATUS_TONE: Record<string, StatusTone> = {
	"pending-payment": "warn",
	confirmed: "info",
	dispatched: "accent",
	delivered: "success",
	cancelled: "danger",
	refunded: "danger",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
	"pending-payment": "Pending payment",
	confirmed: "Confirmed",
	dispatched: "Dispatched",
	delivered: "Delivered",
	cancelled: "Cancelled",
	refunded: "Refunded",
};

const INQUIRY_STATUS_TONE: Record<string, StatusTone> = {
	open: "info",
	"awaiting-customer": "warn",
	resolved: "success",
};

const LOYALTY_KIND_OPTIONS = [
	{ value: "earn", label: "Earn (add)" },
	{ value: "bonus", label: "Bonus (add)" },
	{ value: "redeem", label: "Redeem (subtract)" },
	{ value: "expire", label: "Expire (subtract)" },
	{ value: "adjust", label: "Adjust (signed)" },
];

interface OrderListResponse {
	items: AdminOrderSummary[];
	total: number;
}

interface InquiryListResponse {
	items: AdminInquirySummary[];
	total: number;
}

interface ActivityListResponse {
	items: AdminActivityEntry[];
	total: number;
}

interface IssuedAccessCode {
	code: string;
	expiresInMinutes: number;
}

export interface CustomerDetailPanelProps {
	customerId: string;
	programmeRupeesPerPoint: number;
	canManage: boolean;
	canIssueCode: boolean;
	canAdjustLoyalty: boolean;
	canViewInquiries: boolean;
	canViewActivity: boolean;
	onBack: () => void;
	onDelete: (summary: AdminCustomerSummary) => void;
	onSaved: () => void;
}

export function CustomerDetailPanel({
	customerId,
	programmeRupeesPerPoint,
	canManage,
	canIssueCode,
	canAdjustLoyalty,
	canViewInquiries,
	canViewActivity,
	onBack,
	onDelete,
	onSaved,
}: CustomerDetailPanelProps) {
	const toast = useToast();
	const [activeTab, setActiveTab] = useState<CustomerDetailTab>("overview");
	const [customer, setCustomer] = useState<AdminCustomer | null>(null);
	const [loyaltyAccount, setLoyaltyAccount] = useState<AdminLoyaltyAccount | null>(null);
	const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
	const [inquiries, setInquiries] = useState<AdminInquirySummary[]>([]);
	const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [name, setName] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [city, setCity] = useState("");
	const [isLoyaltyMember, setIsLoyaltyMember] = useState(false);
	const [notes, setNotes] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isIssuingCode, setIsIssuingCode] = useState(false);
	const [issuedCode, setIssuedCode] = useState<IssuedAccessCode | null>(null);

	const load = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			const requests: [
				Promise<AdminCustomer>,
				Promise<{ account: AdminLoyaltyAccount | null }>,
				Promise<OrderListResponse>,
				Promise<InquiryListResponse | null>,
				Promise<ActivityListResponse | null>,
			] = [
				apiFetch<AdminCustomer>(`/api/customers/${customerId}`),
				apiFetch<{ account: AdminLoyaltyAccount | null }>(`/api/customers/${customerId}/loyalty`),
				apiFetch<OrderListResponse>(`/api/orders?customerId=${customerId}&limit=50`),
				canViewInquiries ? apiFetch<InquiryListResponse>(`/api/inquiries?customerId=${customerId}&limit=30`) : Promise.resolve(null),
				canViewActivity ? apiFetch<ActivityListResponse>(`/api/activity?resourceType=customer&resourceId=${customerId}&limit=20`) : Promise.resolve(null),
			];

			const [detail, loyaltyRes, ordersRes, inquiriesRes, activityRes] = await Promise.all(requests);

			setCustomer(detail);
			setLoyaltyAccount(loyaltyRes.account);
			setOrders(ordersRes.items);
			setInquiries(inquiriesRes?.items ?? []);
			setActivity(activityRes?.items ?? []);
			setName(detail.name);
			setPhoneNumber(detail.phoneNumber);
			setCity(detail.city);
			setIsLoyaltyMember(detail.isLoyaltyMember);
			setNotes(detail.notes ?? "");
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : "Failed to load customer");
		} finally {
			setIsLoading(false);
		}
	}, [canViewActivity, canViewInquiries, customerId]);

	useEffect(() => {
		scheduleStateUpdate(() => {
			void load();
		});
	}, [load]);

	async function handleSave(event: FormEvent) {
		event.preventDefault();
		if (!canManage || !customer) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			const updated = await apiFetch<AdminCustomer>(`/api/customers/${customer.id}`, {
				method: "PUT",
				json: {
					name,
					city,
					isLoyaltyMember,
					notes: notes || undefined,
				},
			});
			setCustomer(updated);
			toast.success("Customer updated");
			onSaved();
		} catch (error) {
			const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to save customer";
			setSaveError(message);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleIssueCode() {
		if (!canIssueCode || !customer || isIssuingCode) return;
		setIsIssuingCode(true);
		try {
			const result = await apiFetch<{ code: string; expiresInMinutes: number }>(`/api/customers/${customer.id}/access-code`, { method: "POST" });
			setIssuedCode({ code: result.code, expiresInMinutes: result.expiresInMinutes });
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Failed to issue a sign-in code");
		} finally {
			setIsIssuingCode(false);
		}
	}

	async function copyCustomerId() {
		if (!customer) return;
		try {
			await navigator.clipboard.writeText(customer.id);
			toast.success("Customer ID copied");
		} catch {
			toast.danger("Could not copy ID");
		}
	}

	const tabs = useMemo(() => {
		if (!customer) return [];
		return [
			{ id: "overview" as const, label: "Overview" },
			{ id: "profile" as const, label: "Profile" },
			{
				id: "addresses" as const,
				label: "Addresses",
				count: customer.addresses.length,
			},
			{ id: "orders" as const, label: "Orders", count: orders.length },
			{ id: "loyalty" as const, label: "Loyalty" },
			...(canViewInquiries ? [{ id: "inquiries" as const, label: "Inquiries", count: inquiries.length }] : []),
			...(canViewActivity ? [{ id: "activity" as const, label: "Activity", count: activity.length }] : []),
		];
	}, [activity.length, canViewActivity, canViewInquiries, customer, inquiries.length, orders.length]);

	if (isLoading && !customer) {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-3 md:px-4">
					<div className="flex items-center gap-3">
						<div className="size-10 shrink-0 animate-pulse rounded-full bg-[var(--color-ink-100)]/80" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<div className="h-4 w-40 animate-pulse rounded bg-[var(--color-ink-100)]" />
							<div className="h-2.5 w-28 animate-pulse rounded bg-[var(--color-ink-100)]/70" />
						</div>
					</div>
				</div>
				<div className="flex-1 space-y-3 p-4">
					<div className="grid gap-3 sm:grid-cols-3">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
						))}
					</div>
					<div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-ink-100)]/70" />
				</div>
			</div>
		);
	}

	if (loadError || !customer) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
				<CustomerErrorBanner message={loadError ?? "Customer not found"} />
				<div className="flex gap-2">
					<Button variant="secondary" size="sm" leadingIcon={<RefreshCw size={13} />} onClick={() => void load()}>
						Retry
					</Button>
					<Button variant="ghost" size="sm" onClick={onBack}>
						Back to list
					</Button>
				</div>
			</div>
		);
	}

	const summary: AdminCustomerSummary = {
		id: customer.id,
		name: customer.name,
		phoneNumber: customer.phoneNumber,
		city: customer.city,
		isLoyaltyMember: customer.isLoyaltyMember,
		loyaltyBalance: loyaltyAccount?.balance ?? 0,
		loyaltyLifetimeEarned: loyaltyAccount?.lifetimeEarned ?? 0,
		orderCount: customer.orderCount,
		lifetimeSpendRupees: customer.lifetimeSpendRupees,
		lastOrderAt: customer.lastOrderAt,
		createdAt: customer.createdAt,
		updatedAt: customer.updatedAt,
	};

	const deleteBlocked = customer.orderCount > 0;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<WorkspaceDetailHeader
				onBack={onBack}
				backLabel="Back to customers"
				title={
					<span className="flex min-w-0 items-center gap-2">
						<span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-canvas-deep)] text-[11px] font-semibold text-[var(--color-ink-700)]">
							{getInitials(customer.name)}
						</span>
						<span className="truncate">{customer.name}</span>
					</span>
				}
				subtitle={
					<>
						{customer.city} · {customer.phoneNumber}
					</>
				}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							leadingIcon={<Phone size={12} />}
							onClick={() => {
								window.location.href = `tel:${customer.phoneNumber.replace(/\s+/g, "")}`;
							}}
						>
							Call
						</Button>
						{canIssueCode ? (
							<Button
								variant="outline"
								size="sm"
								leadingIcon={<KeyRound size={12} />}
								onClick={() => void handleIssueCode()}
								isLoading={isIssuingCode}
								title="Generate a one-time code the customer can use to sign in"
							>
								Sign-in code
							</Button>
						) : null}
						{canManage ? (
							<Button
								variant="danger"
								size="sm"
								leadingIcon={<Trash2 size={12} />}
								onClick={() => onDelete(summary)}
								disabled={deleteBlocked}
								title={deleteBlocked ? `Cannot delete — ${customer.orderCount} order${customer.orderCount === 1 ? "" : "s"} on record` : undefined}
							>
								Delete
							</Button>
						) : null}
					</>
				}
			/>

			<TabList
				tabs={tabs}
				activeId={activeTab}
				onChange={(id) => setActiveTab(id as CustomerDetailTab)}
				compact
				fillWhenFew={false}
				aria-label="Customer sections"
				className="shrink-0 bg-[var(--color-surface)] px-2"
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
				{activeTab === "overview" ? (
					<OverviewTab
						customer={customer}
						loyaltyAccount={loyaltyAccount}
						programmeRupeesPerPoint={programmeRupeesPerPoint}
						orders={orders}
						inquiries={inquiries}
						deleteBlocked={deleteBlocked}
						onCopyId={() => void copyCustomerId()}
						onGoTab={setActiveTab}
					/>
				) : null}

				{activeTab === "profile" ? (
					<form onSubmit={handleSave} className="space-y-4">
						{saveError ? <CustomerErrorBanner message={saveError} onDismiss={() => setSaveError(null)} /> : null}
						<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Profile</p>
							<p className="mb-3 text-xs text-[var(--color-ink-500)]">
								Customers sign in on the website with their phone number. You can update name, city, loyalty enrollment, and internal notes here — not the phone used for OTP.
							</p>
							<div className="mt-3 space-y-3">
								<TextField
									label="Full name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									required
									disabled={!canManage}
									maxLength={FIELD_LIMITS.personName}
									placeholder="As they want it printed on invoices"
									autoComplete="name"
								/>
								<div className="grid gap-3 sm:grid-cols-2">
									<TextField
										label="Phone (sign-in ID)"
										value={phoneNumber}
										readOnly
										disabled
										hint="Set when the customer registers on the storefront. Cannot be edited here."
										maxLength={FIELD_LIMITS.phoneNumber}
										inputMode="tel"
									/>
									<TextField
										label="City"
										value={city}
										onChange={(event) => setCity(event.target.value)}
										required
										disabled={!canManage}
										maxLength={FIELD_LIMITS.city}
										placeholder="e.g. your city"
										autoComplete="address-level2"
									/>
								</div>
								<Switch
									label="Loyalty member"
									description="Marks enrollment for programme rules; balance changes happen on the Loyalty tab."
									checked={isLoyaltyMember}
									onCheckedChange={setIsLoyaltyMember}
									disabled={!canManage}
								/>
								<TextArea
									label="Internal notes"
									value={notes}
									onChange={(event) => setNotes(event.target.value)}
									rows={4}
									disabled={!canManage}
									maxLength={2_000}
									placeholder="Support context, preferences, issues to watch…"
								/>
							</div>
							{canManage ? (
								<div className="mt-4 flex justify-end">
									<Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
										Save profile
									</Button>
								</div>
							) : null}
						</section>
					</form>
				) : null}

				{activeTab === "addresses" ? (
					<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<CustomerAddressesSection
							key={customer.id}
							customer={customer}
							canManage={canManage}
							onUpdated={(updated) => {
								setCustomer(updated);
								onSaved();
							}}
						/>
					</section>
				) : null}

				{activeTab === "orders" ? <OrdersTab orders={orders} /> : null}

				{activeTab === "loyalty" ? (
					<LoyaltyTab
						customerId={customer.id}
						customerName={customer.name}
						programmeRupeesPerPoint={programmeRupeesPerPoint}
						account={loyaltyAccount}
						canAdjust={canAdjustLoyalty}
						onAccountUpdated={(account) => {
							setLoyaltyAccount(account);
							onSaved();
						}}
					/>
				) : null}

				{activeTab === "inquiries" && canViewInquiries ? <InquiriesTab inquiries={inquiries} phoneNumber={customer.phoneNumber} /> : null}

				{activeTab === "activity" && canViewActivity ? <ActivityTab entries={activity} /> : null}
			</div>

			{issuedCode ? (
				<CustomerAccessCodeDialog
					isOpen
					customerName={customer.name}
					phoneNumber={customer.phoneNumber}
					code={issuedCode.code}
					expiresInMinutes={issuedCode.expiresInMinutes}
					onClose={() => setIssuedCode(null)}
				/>
			) : null}
		</div>
	);
}

function OverviewTab({
	customer,
	loyaltyAccount,
	programmeRupeesPerPoint,
	orders,
	inquiries,
	deleteBlocked,
	onCopyId,
	onGoTab,
}: {
	customer: AdminCustomer;
	loyaltyAccount: AdminLoyaltyAccount | null;
	programmeRupeesPerPoint: number;
	orders: AdminOrderSummary[];
	inquiries: AdminInquirySummary[];
	deleteBlocked: boolean;
	onCopyId: () => void;
	onGoTab: (tab: CustomerDetailTab) => void;
}) {
	return (
		<div className="space-y-5">
			<div className="grid gap-3 sm:grid-cols-3">
				<CustomerStatCard label="Lifetime spend" value={formatPrice(customer.lifetimeSpendRupees)} />
				<CustomerStatCard label="Orders" value={String(customer.orderCount)} />
				<CustomerStatCard
					label="Loyalty balance"
					value={loyaltyAccount ? `${loyaltyAccount.balance.toLocaleString()} pts` : "—"}
					sub={loyaltyAccount ? formatPrice(loyaltyAccount.balance * programmeRupeesPerPoint) : undefined}
				/>
			</div>

			<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Account & support</p>
				<ul className="mt-3 space-y-2 text-xs text-[var(--color-ink-700)]">
					<li className="flex flex-wrap items-center gap-2">
						<span className="text-[var(--color-ink-500)]">Customer ID</span>
						<code className="rounded bg-[var(--color-canvas-deep)] px-1.5 py-0.5 font-mono text-[10px]">{customer.id}</code>
						<Button variant="ghost" size="sm" leadingIcon={<Copy size={11} />} onClick={onCopyId}>
							Copy
						</Button>
					</li>
					<li>
						<span className="text-[var(--color-ink-500)]">Customer login</span>
						<span className="ml-2">OTP via {customer.phoneNumber}</span>
					</li>
					<li>
						<span className="text-[var(--color-ink-500)]">Member since</span>
						<span className="ml-2">{new Date(customer.createdAt).toLocaleString()}</span>
					</li>
					<li>
						<span className="text-[var(--color-ink-500)]">Last updated</span>
						<span className="ml-2">{formatTimeAgo(customer.updatedAt)}</span>
					</li>
					{deleteBlocked ? (
						<li className="rounded-[var(--radius-md)] border border-amber-100 bg-amber-50 px-2.5 py-2 text-amber-900">
							This customer has {customer.orderCount} order
							{customer.orderCount === 1 ? "" : "s"} — delete is blocked to preserve order history.
						</li>
					) : null}
				</ul>
			</section>

			{customer.notes ? (
				<section className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Internal notes</p>
					<p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-ink-700)]">{customer.notes}</p>
				</section>
			) : null}

			{orders.length > 0 ? (
				<section>
					<div className="mb-2 flex items-center justify-between">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Recent orders</p>
						<Button variant="ghost" size="sm" onClick={() => onGoTab("orders")}>
							View all
						</Button>
					</div>
					<OrdersTab orders={orders.slice(0, 3)} compact />
				</section>
			) : null}

			{inquiries.length > 0 ? (
				<section>
					<div className="mb-2 flex items-center justify-between">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Recent inquiries</p>
						<Button variant="ghost" size="sm" onClick={() => onGoTab("inquiries")}>
							View all
						</Button>
					</div>
					<InquiriesTab inquiries={inquiries.slice(0, 3)} phoneNumber={customer.phoneNumber} compact />
				</section>
			) : null}
		</div>
	);
}

function OrdersTab({ orders, compact }: { orders: AdminOrderSummary[]; compact?: boolean }) {
	if (orders.length === 0) {
		return (
			<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-8 text-center text-xs text-[var(--color-ink-500)]">No orders yet.</p>
		);
	}
	return (
		<ul className="space-y-2">
			{orders.map((order) => (
				<li key={order.id}>
					<Link
						href={`/orders?order=${order.id}`}
						className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--color-canvas-deep)]"
					>
						<span className="min-w-0">
							<span className="font-semibold text-[var(--color-ink-900)]">{order.orderNumber}</span>
							{!compact ? (
								<StatusPill tone={ORDER_STATUS_TONE[order.status] ?? "neutral"} className="ml-2">
									{ORDER_STATUS_LABELS[order.status] ?? order.status}
								</StatusPill>
							) : null}
							<span className="ml-2 text-[10px] text-[var(--color-ink-500)]">
								{formatTimeAgo(order.placedAt)} · {order.itemCount} item
								{order.itemCount === 1 ? "" : "s"}
							</span>
						</span>
						<span className="font-semibold text-[var(--color-ink-900)]">{formatPrice(order.totalRupees)}</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

function InquiriesTab({ inquiries, phoneNumber, compact }: { inquiries: AdminInquirySummary[]; phoneNumber: string; compact?: boolean }) {
	if (inquiries.length === 0) {
		return (
			<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-8 text-center text-xs text-[var(--color-ink-500)]">
				No inquiries linked to this customer.
				{!compact ? (
					<>
						{" "}
						Threads may still exist under phone{" "}
						<Link href="/inquiries" className="font-semibold text-[var(--color-accent-700)]">
							{phoneNumber}
						</Link>
						.
					</>
				) : null}
			</p>
		);
	}
	return (
		<ul className="space-y-2">
			{inquiries.map((inquiry) => (
				<li key={inquiry.id}>
					<Link
						href={`/inquiries?inquiry=${inquiry.id}`}
						className="flex items-start justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--color-canvas-deep)]"
					>
						<span className="min-w-0">
							<span className="flex items-center gap-2">
								<MessageSquare size={13} className="shrink-0 text-[var(--color-ink-400)]" />
								<span className="truncate text-sm font-semibold text-[var(--color-ink-900)]">{inquiry.subjectProductName ?? "General inquiry"}</span>
							</span>
							<span className="mt-0.5 block truncate text-[10px] text-[var(--color-ink-500)]">{inquiry.lastMessagePreview || "No messages"}</span>
						</span>
						<span className="shrink-0 text-right">
							<StatusPill tone={INQUIRY_STATUS_TONE[inquiry.status] ?? "neutral"}>{inquiry.status}</StatusPill>
							<span className="mt-1 block text-[10px] text-[var(--color-ink-400)]">{formatTimeAgo(inquiry.lastMessageAt)}</span>
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
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

function ActivityTab({ entries }: { entries: AdminActivityEntry[] }) {
	if (entries.length === 0) {
		return (
			<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-8 text-center text-xs text-[var(--color-ink-500)]">
				No activity recorded for this customer yet.
			</p>
		);
	}
	return (
		<ul className="space-y-2">
			{entries.map((entry) => (
				<li key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2 text-xs">
					<p className="font-semibold text-[var(--color-ink-900)]">
						{formatActivityAction(entry.action)} · {getResourceLink(entry)}
					</p>
					<p className="text-[10px] text-[var(--color-ink-500)]">
						{entry.actorName} · {formatTimeAgo(entry.createdAt)}
					</p>
					<ActivityDetailGrid detail={entry.detail || ""} />
				</li>
			))}
		</ul>
	);
}

function LoyaltyTab({
	customerId,
	customerName,
	programmeRupeesPerPoint,
	account,
	canAdjust,
	onAccountUpdated,
}: {
	customerId: string;
	customerName: string;
	programmeRupeesPerPoint: number;
	account: AdminLoyaltyAccount | null;
	canAdjust: boolean;
	onAccountUpdated: (account: AdminLoyaltyAccount) => void;
}) {
	const toast = useToast();
	const [kind, setKind] = useState("earn");
	const [amount, setAmount] = useState(100);
	const [reason, setReason] = useState("");
	const [orderRef, setOrderRef] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const balance = account?.balance ?? 0;
	const lifetime = account?.lifetimeEarned ?? 0;

	async function handleAdjust(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canAdjust) return;
		setIsSaving(true);
		setError(null);
		try {
			const updated = await apiFetch<AdminLoyaltyAccount>(`/api/loyalty/${customerId}/transactions`, {
				method: "POST",
				json: { kind, amount, reason, orderRef: orderRef || undefined },
			});
			onAccountUpdated(updated);
			setReason("");
			setOrderRef("");
			toast.success("Loyalty balance updated");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to adjust loyalty");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
			<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Loyalty programme</p>
			{error ? <CustomerErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
			{!account ? (
				<p className="text-xs text-[var(--color-ink-500)]">
					No loyalty account yet. Post a points adjustment below to open an account for {customerName} (usually created automatically when they earn points on an order).
				</p>
			) : (
				<div className="grid gap-2 sm:grid-cols-3">
					<CustomerStatCard label="Balance" value={`${balance.toLocaleString()} pts`} />
					<CustomerStatCard label="Cash value" value={formatPrice(balance * programmeRupeesPerPoint)} />
					<CustomerStatCard label="Lifetime earned" value={`${lifetime.toLocaleString()} pts`} />
				</div>
			)}

			{canAdjust ? (
				<form onSubmit={handleAdjust} className="space-y-3 border-t border-[var(--color-ink-100)] pt-3">
					<SelectField label="Adjustment kind" value={kind} onChange={(event) => setKind(event.target.value)} options={LOYALTY_KIND_OPTIONS} />
					<TextField
						label="Points"
						type="number"
						value={amount}
						onChange={(event) => setAmount(Number(event.target.value) || 0)}
						required
						inputMode="numeric"
						placeholder="e.g. 100"
						hint="Always enter a positive number — the kind above decides the sign."
					/>
					<TextField
						label="Order ref (optional)"
						value={orderRef}
						onChange={(event) => setOrderRef(event.target.value)}
						maxLength={ORDER_REF_INPUT_MAX}
						placeholder="e.g. ORD-2025-0123"
						hint="Link this adjustment to a specific order, if applicable."
					/>
					<TextArea
						label="Reason"
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						rows={2}
						required
						maxLength={FIELD_LIMITS.shortText}
						placeholder="Why are you adjusting? (e.g. goodwill credit for delayed shipment)"
					/>
					<Button type="submit" variant="secondary" size="sm" isLoading={isSaving}>
						Apply adjustment
					</Button>
				</form>
			) : null}

			{account && account.transactions.length > 0 ? (
				<ul className="space-y-1.5 border-t border-[var(--color-ink-100)] pt-3">
					{account.transactions
						.slice(-RECENT_TRANSACTIONS_PREVIEW)
						.reverse()
						.map((transaction) => (
							<li key={transaction.id} className="rounded-[var(--radius-sm)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-1.5 text-xs">
								<p className="font-semibold text-[var(--color-ink-900)]">
									{transaction.kind} · {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount} pts
								</p>
								<p className="text-[10px] text-[var(--color-ink-500)]">{new Date(transaction.occurredAt).toLocaleString()}</p>
								<p className="text-[var(--color-ink-700)]">{transaction.reason}</p>
							</li>
						))}
				</ul>
			) : null}
		</section>
	);
}
