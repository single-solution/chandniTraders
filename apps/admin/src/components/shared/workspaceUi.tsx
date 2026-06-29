"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { classNames } from "@store/shared";
import { Button } from "@store/ui";

import { Skeleton } from "@/components/ui/Skeleton";

/** Content wrapper for split-pane workspaces (orders, customers, inquiries). */
export const adminWorkspacePageClass = "admin-mobile-pad flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 md:p-2";

/** Content wrapper for scrollable catalog workspaces (products, categories). */
export const adminCatalogPageClass = "admin-mobile-pad flex min-h-0 flex-1 flex-col overflow-y-auto p-1.5 md:p-2";

/** Content wrapper for single-pane list workspaces (team, offers, activity). */
export const adminListPageClass = adminCatalogPageClass;

/** Default content wrapper for free-form scrollable pages (dashboard). */
export const adminDefaultPageClass = "flex-1 overflow-y-auto px-3 py-2 md:px-4 md:py-3";

export function WorkspaceFrame({ children, className, minHeight = true }: { children: ReactNode; className?: string; minHeight?: boolean }) {
	return (
		<div
			className={classNames(
				"reveal-stagger reveal animate-in flex flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]",
				minHeight && "min-h-[min(72vh,680px)]",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function WorkspaceSidebarNavItem({
	label,
	count,
	isActive,
	onClick,
}: {
	label: string;
	/** `null` renders a shimmer (still loading); `undefined` renders a muted dash
	 *  (count unavailable) — for counts streamed in after first paint. */
	count: number | null | undefined;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className={classNames(
					"flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-left text-[13px] transition-all",
					isActive
						? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-900)] shadow-sm"
						: "text-[var(--color-ink-700)] hover:-translate-y-px hover:bg-[var(--color-surface)] hover:text-[var(--color-ink-900)] hover:shadow-sm",
				)}
			>
				<span className="truncate">{label}</span>
				{count === null ? <Skeleton shape="text" className="h-3 w-5 shrink-0" /> : <span className="shrink-0 tabular-nums text-[10.5px] opacity-70">{count ?? "—"}</span>}
			</button>
		</li>
	);
}

export function WorkspaceFilterChip({
	label,
	count,
	isActive,
	onClick,
	compact,
}: {
	label: string;
	/** Omit for no badge; pass `null` to render a shimmer while a count streams in. */
	count?: number | null;
	isActive: boolean;
	onClick: () => void;
	compact?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={classNames(
				"inline-flex items-center gap-1 font-semibold transition-all hover:-translate-y-px hover:shadow-sm",
				compact ? "rounded-full px-2 py-0.5 text-[0.625rem]" : "rounded-full px-3 py-1 text-[11px]",
				isActive
					? "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] shadow-sm"
					: "border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-600)] shadow-[var(--shadow-sm)] hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]",
			)}
		>
			{label}
			{count === null ? (
				<Skeleton shape="pill" className="h-3 w-3.5" />
			) : typeof count === "number" ? (
				<span
					className={classNames(
						"rounded-full px-1 tabular-nums text-[0.5625rem]",
						isActive ? "bg-[var(--color-accent-200)]/70 text-[var(--color-accent-800)]" : "bg-[var(--color-canvas-deep)] text-[var(--color-ink-500)]",
					)}
				>
					{count}
				</span>
			) : null}
		</button>
	);
}

export function WorkspaceSearchField({
	value,
	onChange,
	placeholder,
	className,
	"aria-label": ariaLabel,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	className?: string;
	"aria-label": string;
}) {
	return (
		<label className={classNames("relative flex h-9 items-center", className)}>
			<Search size={14} className="pointer-events-none absolute left-3 text-[var(--color-ink-400)]" aria-hidden />
			<input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-label={ariaLabel}
				className="h-full w-full rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] pl-9 pr-3 text-[12.5px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-ink-300)] focus:border-[var(--color-accent-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)]"
			/>
		</label>
	);
}

/**
 * Icon-bearing workspace components accept a pre-rendered `ReactNode`
 * rather than a Lucide component reference. This keeps the API safe to
 * call from server components — React component references (forwardRefs)
 * are not serializable across the RSC boundary, but rendered elements
 * are. Callers render their icon with the size called out in JSDoc.
 */

export function WorkspacePaneHeader({
	iconElement,
	title,
	subtitle,
	search,
	action,
}: {
	/** Render at `size={15}` for visual consistency. */
	iconElement: ReactNode;
	title: string;
	subtitle?: ReactNode;
	search?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<header className="admin-mobile-sticky shrink-0 space-y-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2.5">
			<div className="reveal flex items-center gap-2">
				<span className="shrink-0 text-[var(--color-accent-700)]">{iconElement}</span>
				<div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<h2 className="text-sm font-semibold text-[var(--color-ink-900)]">{title}</h2>
					{subtitle ? <span className="truncate text-[10px] leading-tight text-[var(--color-ink-500)]">{subtitle}</span> : null}
				</div>
				{action}
			</div>
			{search}
		</header>
	);
}

export function WorkspaceEmptyPane({
	iconElement,
	title,
	description,
	action,
}: {
	/** Render at `size={22}` for visual consistency. */
	iconElement: ReactNode;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="reveal animate-in flex flex-1 flex-col items-center justify-center px-5 py-8 text-center md:px-6 md:py-12">
			<span className="grid size-12 place-items-center rounded-full bg-[var(--color-accent-50)] text-[var(--color-accent-700)] md:size-14">{iconElement}</span>
			<p className="mt-3 text-[13px] font-semibold text-[var(--color-ink-900)] md:mt-4 md:text-sm">{title}</p>
			<p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-[var(--color-ink-500)] md:text-xs">{description}</p>
			{action ? <div className="mt-3 md:mt-4">{action}</div> : null}
		</div>
	);
}

export function WorkspaceListHeader({
	iconElement,
	title,
	subtitle,
	action,
}: {
	/** Render at `size={15}` for visual consistency. */
	iconElement: ReactNode;
	title: string;
	subtitle?: string;
	action?: ReactNode;
}) {
	return (
		<header className="reveal animate-in admin-mobile-sticky flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2 md:gap-3 md:px-4 md:py-3">
			<div className="flex min-w-0 items-center gap-2 md:gap-2.5">
				<span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)] md:size-9">
					{iconElement}
				</span>
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<h2 className="text-[0.8125rem] font-semibold text-[var(--color-ink-900)] md:text-sm">{title}</h2>
					{subtitle ? <span className="truncate text-[10px] leading-tight text-[var(--color-ink-500)]">{subtitle}</span> : null}
				</div>
			</div>
			{action}
		</header>
	);
}

export function WorkspaceRowIconButton({
	label,
	onClick,
	iconElement,
	tone = "default",
	disabled,
}: {
	label: string;
	onClick: () => void;
	/** Render at `size={13}` for visual consistency. */
	iconElement: ReactNode;
	tone?: "default" | "danger";
	disabled?: boolean;
}) {
	return (
		<Button variant={tone === "danger" ? "danger" : "ghost"} size="sm" aria-label={label} disabled={disabled} onClick={onClick} className="px-2!">
			{iconElement}
		</Button>
	);
}

export function WorkspacePrimaryAction({
	label,
	onClick,
	iconElement,
	disabled,
}: {
	label: string;
	onClick: () => void;
	/** Render at `size={14}` for visual consistency. */
	iconElement?: ReactNode;
	disabled?: boolean;
}) {
	return (
		<Button variant="primary" size="sm" leadingIcon={iconElement} onClick={onClick} disabled={disabled}>
			{label}
		</Button>
	);
}

export function WorkspaceReadOnlyBanner({ message }: { message: string }) {
	return <p className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-2 text-center text-[11px] text-[var(--color-ink-600)]">{message}</p>;
}

/** Catalog workspace main column header (products, categories tables). */
export function WorkspaceCatalogPaneHeader({
	title,
	subtitle,
	search,
	filters,
	action,
}: {
	title: ReactNode;
	subtitle?: string;
	search?: ReactNode;
	filters?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<header className="reveal animate-in admin-mobile-sticky shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 py-2">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mr-auto">
					<div className="flex min-w-0 items-center gap-1.5">{title}</div>
					{subtitle ? <span className="truncate text-[10px] font-normal leading-tight text-[var(--color-ink-500)]">{subtitle}</span> : null}
				</div>
				<div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-nowrap">
					{search}
					{action}
				</div>
			</div>
			{filters ? <div className="mt-2 flex flex-wrap gap-1.5">{filters}</div> : null}
		</header>
	);
}

/** Split-pane detail column header (orders, customers, inquiries). */
export function WorkspaceDetailHeader({
	onBack,
	backLabel,
	title,
	subtitle,
	badge,
	actions,
}: {
	onBack?: () => void;
	backLabel?: string;
	title: ReactNode;
	subtitle?: ReactNode;
	badge?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className="reveal animate-in flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-surface)] px-2.5 py-2 md:gap-3 md:px-4 md:py-3">
			{onBack ? (
				<Button variant="ghost" size="sm" type="button" aria-label={backLabel ?? "Back to list"} onClick={onBack} className="lg:hidden px-2!">
					<ArrowLeft size={16} />
				</Button>
			) : null}
			<div className="min-w-0 flex-1">
				<div className="text-[13px] font-semibold text-[var(--color-ink-900)] md:text-sm">{title}</div>
				{subtitle ? <div className="text-[11.5px] text-[var(--color-ink-500)] md:text-xs">{subtitle}</div> : null}
			</div>
			{badge}
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
		</header>
	);
}
