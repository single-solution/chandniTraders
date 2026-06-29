import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStoreSettings } from "@store/db";
import { classNames, formatPrice, LOYALTY_PROGRAM_NAME } from "@store/shared";
import { ChevronRight, LayoutDashboard, MapPin, Package, ShieldCheck, Sparkles, Truck, User } from "lucide-react";
import { Card } from "@/components/ui/Card";

import { auth } from "@/lib/auth";
import { getAccountOverview } from "@/lib/core/account";

import { SignOutButton } from "@/app/account/_components/SignOutButton";
import { OrderHistory } from "@/app/account/_components/OrderHistory";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

export const metadata: Metadata = {
	title: "Your account",
	description: "View orders, manage addresses and pick up where you left off.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user || session.user.role !== "customer" || !session.user.customerId) {
		// Valid JWT but unusable claims — clear the cookie so we don't loop with
		// the middleware (which would treat the request as still logged-in).
		redirect("/account/sign-out");
	}

	const [overview] = await Promise.all([
		getAccountOverview(session.user.customerId),
		getStoreSettings(), // Prefetch to warm cache
	]);
	if (!overview) {
		// Customer record was deleted under a still-valid session — sign them out
		// (not just redirect to sign-in, or the middleware bounces us back here).
		redirect("/account/sign-out");
	}

	return (
		<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-6 md:pb-16 md:pt-10`}>
			<AccountHeader name={overview.customer.name} joinedAt={overview.customer.joinedAt} />

			<div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[1fr_360px] md:gap-6 lg:gap-8 lg:grid-cols-[1fr_400px]">
				<div className="cv-auto space-y-6 md:space-y-8">
					<div className="reveal-stagger grid gap-4 md:grid-cols-3 md:gap-5">
						<div className="reveal h-full">
							<StatCard icon={<Truck size={16} />} label="Active orders" value={String(overview.activeCount)} href="#orders" accent="amber" />
						</div>
						<div className="reveal h-full">
							<StatCard icon={<Package size={16} />} label="All-time orders" value={String(overview.totalCount)} href="#orders" accent="ink" />
						</div>
						<div className="reveal h-full">
							<StatCard icon={<ShieldCheck size={16} />} label="Total spent" value={formatPrice(overview.totalSpentRupees)} accent="emerald" />
						</div>
					</div>

					<OrderHistory orders={overview.allOrders} />
				</div>

				<aside className="reveal-stagger space-y-4 md:sticky md:top-[calc(var(--desktop-header-h)+24px)] md:self-start">
					<div className="reveal">{overview.loyalty ? <LoyaltyCard loyalty={overview.loyalty} /> : <NotALoyaltyMember />}</div>
					<div className="reveal">
						<ProfileCard customer={overview.customer} />
					</div>
				</aside>
			</div>
		</div>
	);
}

function AccountHeader({ name, joinedAt }: { name: string; joinedAt: string }) {
	const firstName = name.split(" ")[0];

	return (
		<div className="reveal flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
			<div>
				<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Salam, {firstName}</p>
				<h1 className="mt-1 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">Welcome back.</h1>
				<p className="mt-1 max-w-prose text-[13px] text-[var(--color-ink-500)] md:text-sm">View orders, manage addresses and pick up where you left off.</p>
			</div>
			<div className="flex items-center gap-2">
				<div className="hidden items-center gap-2 rounded-full bg-[var(--color-accent-50)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-accent-800)] md:inline-flex">
					<LayoutDashboard size={13} />
					Customer · Member since {new Date(joinedAt).getFullYear()}
				</div>
				<SignOutButton />
			</div>
		</div>
	);
}

function LoyaltyCard({ loyalty }: { loyalty: { balance: number; lifetimeEarned: number; pendingFromShipping: number } }) {
	const { balance, lifetimeEarned, pendingFromShipping } = loyalty;
	return (
		<div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-accent-200)] bg-gradient-to-br from-[var(--color-accent-100)] via-[var(--color-accent-50)] to-[var(--color-canvas)] shadow-[var(--shadow-sm)]">
			<div className="space-y-4 p-5 md:p-6">
				<div className="flex items-center gap-2">
					<span className="grid size-8 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
						<Sparkles size={15} strokeWidth={2.4} />
					</span>
					<p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-800)]">{LOYALTY_PROGRAM_NAME}</p>
				</div>
				<div>
					<p className="font-headline text-[36px] font-semibold leading-[1] tracking-tight text-[var(--color-ink-900)] md:text-[44px]">{balance.toLocaleString("en-PK")}</p>
					<p className="mt-1 text-[12px] font-medium text-[var(--color-accent-800)]">
						{LOYALTY_PROGRAM_NAME.toLowerCase()} available · worth <span className="font-semibold text-[var(--color-ink-900)]">{formatPrice(balance)}</span> off
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--color-ink-700)]">
					<span>
						<span className="font-semibold text-[var(--color-ink-900)]">{lifetimeEarned.toLocaleString("en-PK")}</span> lifetime
					</span>
					{pendingFromShipping > 0 && (
						<span>
							<span className="font-semibold text-[var(--color-ink-900)]">{pendingFromShipping.toLocaleString("en-PK")}</span> pending
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function NotALoyaltyMember() {
	return (
		<Card className="flex items-center gap-3 p-4 md:p-5">
			<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-700)]">
				<Sparkles size={16} />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">Join {LOYALTY_PROGRAM_NAME}</p>
				<p className="mt-0.5 max-w-prose text-[12px] text-[var(--color-ink-500)]">Earn points on every order — ask us at checkout to enrol.</p>
			</div>
		</Card>
	);
}

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string;
	href?: string;
	accent: "amber" | "ink" | "emerald";
}

function StatCard({ icon, label, value, href, accent }: StatCardProps) {
	const accentClasses: Record<StatCardProps["accent"], string> = {
		amber: "bg-[var(--color-accent-100)] text-[var(--color-accent-800)]",
		ink: "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]",
		emerald: "bg-[var(--color-success-50)] text-[var(--color-success-700)]",
	};
	const Wrapper: React.ElementType = href ? Link : "div";
	const props = href ? { href } : {};
	return (
		<Wrapper
			{...props}
			/* Concentric: inner icon well --radius-md (8) + p-4/p-5 (16/20)
         → outer 24/28 ≈ --radius-2xl (24, within 4px of p-5). */
			className="tap lift block rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5"
		>
			<div className="flex items-center justify-between">
				<span className={classNames("grid size-8 place-items-center rounded-[var(--radius-md)]", accentClasses[accent])}>{icon}</span>
				{href && <ChevronRight size={14} className="text-[var(--color-ink-400)]" />}
			</div>
			<p className="mt-3 text-[20px] font-semibold tracking-tight text-[var(--color-ink-900)] md:text-[24px]">{value}</p>
			<p className="mt-0.5 text-[12px] font-medium text-[var(--color-ink-500)]">{label}</p>
		</Wrapper>
	);
}

interface ProfileCardProps {
	customer: {
		name: string;
		phoneNumber: string;
		addresses: { recipientName: string; phoneNumber: string; city: string; area?: string; street?: string; isDefault: boolean }[];
	};
}

function ProfileCard({ customer }: ProfileCardProps) {
	const defaultAddress = customer.addresses.find((address) => address.isDefault) ?? customer.addresses[0];
	return (
		<Card className="overflow-hidden">
			<div className="flex items-center gap-3 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/60 p-4 md:p-5">
				<span className="grid size-10 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
					<User size={16} />
				</span>
				<div className="min-w-0 flex-1">
					<p className="line-clamp-1 text-[14px] font-semibold text-[var(--color-ink-900)]">{customer.name}</p>
					<p className="line-clamp-1 text-[12px] text-[var(--color-ink-500)]">{customer.phoneNumber}</p>
				</div>
			</div>
			{defaultAddress ? (
				<div className="border-b border-[var(--color-ink-100)] p-4 md:p-5">
					<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Default address</p>
					<div className="mt-2 flex items-start gap-2">
						<MapPin size={13} className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" />
						<p className="text-[12.5px] leading-snug text-[var(--color-ink-700)]">
							{[defaultAddress.street, defaultAddress.area].filter(Boolean).join(", ") || defaultAddress.recipientName}
							<br />
							{defaultAddress.city} · {defaultAddress.phoneNumber}
						</p>
					</div>
				</div>
			) : (
				<div className="max-w-prose border-b border-[var(--color-ink-100)] p-4 text-[12.5px] text-[var(--color-ink-500)] md:p-5">
					No saved addresses yet — we&rsquo;ll save the address from your next order.
				</div>
			)}
			<div className="p-3 md:p-4">
				<Link
					href="/account/profile"
					className="cta-arrow tap inline-flex w-full items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] py-2 text-[12.5px] font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-ink-300)]"
				>
					Edit profile
					<ChevronRight size={13} />
				</Link>
			</div>
		</Card>
	);
}
