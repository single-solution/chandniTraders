"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { classNames } from "@store/shared";

import { usePresence } from "@/components/shared/motion/usePresence";
import { shopCatalogPillClass } from "@/components/shared/shopCatalogPillStyles";
import { Popover } from "@/components/ui/Popover";

/** Matches `.animate-filter-panel-out` duration in globals.css. */
const FILTER_PANEL_EXIT_MS = 220;

interface FilterDropdownProps {
	label: string;
	activeCount?: number;
	children: React.ReactNode;
	className?: string;
	triggerClassName?: string;
	panelClassName?: string;
	align?: "left" | "center" | "right";
}

/** Pill trigger + portaled panel — used by shop filter row variants. */
export function FilterDropdown({ label, activeCount = 0, children, className, triggerClassName, panelClassName, align = "left" }: FilterDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const panelId = useId();
	const isActive = activeCount > 0;
	const { isMounted: isPanelMounted, status: panelStatus } = usePresence(isOpen, FILTER_PANEL_EXIT_MS);
	const isPanelClosing = panelStatus === "closing";

	const panelOriginClass = align === "center" ? "origin-top" : align === "right" ? "origin-top-right" : "origin-top-left";

	return (
		<div ref={rootRef} className={classNames("relative min-w-0 max-w-full shrink-0", className)}>
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={panelId}
				className={classNames(shopCatalogPillClass(isActive), "max-w-full", triggerClassName)}
			>
				<span className="min-w-0 max-w-[12rem] truncate whitespace-nowrap sm:max-w-[16rem]">{label}</span>
				{isActive ? (
					<span className="grid size-3.5 place-items-center rounded-full bg-[var(--color-accent-500)] text-[8px] font-semibold leading-none text-[var(--color-ink-900)]">
						{activeCount}
					</span>
				) : null}
				<ChevronDown
					size={12}
					aria-hidden
					className={classNames("shrink-0 text-[var(--color-ink-500)] transition-transform duration-[var(--motion-slow)] ease-[var(--ease-out-quart)]", isOpen && "rotate-180")}
				/>
			</button>

			<Popover
				isOpen={isPanelMounted}
				anchorRef={rootRef}
				align={align}
				onRequestClose={() => setIsOpen(false)}
				className={classNames(
					"z-50 overflow-y-auto overscroll-contain rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2.5 shadow-[var(--shadow-lg)]",
					panelOriginClass,
					isPanelClosing ? "animate-filter-panel-out" : "animate-filter-panel-in",
					panelClassName ?? "max-h-[min(360px,52vh)] min-w-[240px] max-w-[min(320px,calc(100vw-2rem))]",
				)}
			>
				<div id={panelId}>{children}</div>
			</Popover>
		</div>
	);
}
