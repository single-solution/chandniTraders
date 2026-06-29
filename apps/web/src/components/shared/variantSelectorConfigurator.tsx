"use client";

import { MessageCircle, Settings2 } from "lucide-react";

import { buildWhatsAppLink, classNames } from "@store/shared";
import type { Variant } from "@store/shared";

import { useStoreSettings } from "@/lib/core/storeSettingsContext";

import { buildConfiguratorIntroHint, computeOptionState, filterOptionsForUpstreamSelection, type Dimension } from "./variantSelectorDimensions";
import { ConfigurationRealignmentNotice } from "./variantSelectorConfigurationFeedback";

interface ConfiguratorProps {
	dimensions: Dimension[];
	variants: Variant[];
	currentSelection: Record<string, string>;
	onPick: (dimensionKey: string, optionKey: string) => void;
	realignmentNotice?: string | null;
	realignmentDimensionKey?: string | null;
}

export function Configurator({ dimensions, variants, currentSelection, onPick, realignmentNotice = null, realignmentDimensionKey = null }: ConfiguratorProps) {
	if (dimensions.length === 0) {
		return null;
	}

	const hasHierarchy = dimensions.length > 1;
	const introHint = buildConfiguratorIntroHint(dimensions);

	return (
		<section
			aria-label="Build your configuration"
			className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
		>
			<header className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/55 px-2.5 py-2 md:px-3 md:py-2.5">
				<div className="flex items-center gap-1.5">
					<Settings2 size={14} className="shrink-0 text-[var(--color-accent-700)]" aria-hidden />
					<h2 className="text-[13px] font-semibold tracking-tight text-[var(--color-ink-900)] md:text-sm">Build your configuration</h2>
				</div>
				{introHint ? <p className="mt-1 text-[10px] leading-snug text-[var(--color-ink-500)] md:mt-1.5 md:text-[10.5px]">{introHint}</p> : null}
			</header>
			<div className="divide-y divide-[var(--color-ink-100)]">
				{dimensions.map((dimension, index) => (
					<DimensionRow
						key={dimension.key}
						dimension={dimension}
						dimensionIndex={index}
						dimensions={dimensions}
						variants={variants}
						currentSelection={currentSelection}
						onPick={onPick}
						isAnchor={hasHierarchy && index === 0}
						realignmentNotice={realignmentDimensionKey === dimension.key ? realignmentNotice : null}
					/>
				))}
			</div>
		</section>
	);
}

interface DimensionRowProps {
	dimension: Dimension;
	dimensionIndex: number;
	dimensions: Dimension[];
	variants: Variant[];
	currentSelection: Record<string, string>;
	onPick: (dimensionKey: string, optionKey: string) => void;
	isAnchor?: boolean;
	realignmentNotice?: string | null;
}

function DimensionRow({ dimension, dimensionIndex, dimensions, variants, currentSelection, onPick, isAnchor = false, realignmentNotice = null }: DimensionRowProps) {
	const visibleOptions = filterOptionsForUpstreamSelection(dimension, dimensionIndex, dimensions, variants, currentSelection);

	if (visibleOptions.length === 0) {
		return null;
	}

	return (
		<div
			className={classNames(
				"flex flex-col gap-1.5 px-2.5 py-2 md:px-3 md:py-2.5",
				isAnchor && "border-b-2 border-[var(--color-accent-500)] bg-gradient-to-b from-[var(--color-accent-50)] to-[var(--color-surface)]",
			)}
		>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span
					className={classNames(
						"text-[9.5px] font-semibold uppercase tracking-[0.2em] md:text-[10.5px]",
						isAnchor ? "text-[var(--color-accent-800)]" : "text-[var(--color-ink-500)]",
					)}
				>
					{dimension.label}
				</span>
			</div>

			<DimensionTabRow dimension={dimension} options={visibleOptions} variants={variants} currentSelection={currentSelection} onPick={onPick} />

			{realignmentNotice ? <ConfigurationRealignmentNotice message={realignmentNotice} /> : null}
		</div>
	);
}

interface DimensionTabRowProps {
	dimension: Dimension;
	options: Dimension["options"];
	variants: Variant[];
	currentSelection: Record<string, string>;
	onPick: (dimensionKey: string, optionKey: string) => void;
}

function DimensionTabRow({ dimension, options, variants, currentSelection, onPick }: DimensionTabRowProps) {
	return (
		<div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-200)]" role="tablist" aria-label={dimension.label}>
			<div className="-ml-px -mt-px flex flex-wrap md:m-0 md:flex-nowrap md:divide-x md:divide-[var(--color-ink-200)]">
				{options.map((option) => {
					const isSelected = currentSelection[dimension.key] === option.key;
					const state = computeOptionState(dimension.key, option.key, variants, currentSelection);
					const isOutOfStock = state === "out_of_stock" && !isSelected;

					return (
						<button
							key={option.key}
							type="button"
							role="tab"
							onClick={() => onPick(dimension.key, option.key)}
							disabled={isOutOfStock}
							aria-selected={isSelected}
							aria-disabled={isOutOfStock}
							data-state={state}
							title={isOutOfStock ? "Out of stock for this option" : undefined}
							className={classNames(
								"flex grow basis-[31%] items-center justify-center whitespace-nowrap border-l border-t border-[var(--color-ink-200)] px-1.5 py-1.5 text-center text-[10px] font-medium leading-snug transition-all md:basis-0 md:flex-1 md:border-0 md:px-2 md:py-2 md:text-[11px]",
								isSelected &&
									"rounded-[var(--radius-sm)] bg-[var(--color-accent-50)] font-semibold text-[var(--color-accent-800)] shadow-[var(--shadow-sm)] ring-1 ring-inset ring-[var(--color-accent-500)]",
								!isSelected && !isOutOfStock && "bg-[var(--color-surface)] text-[var(--color-ink-800)] hover:bg-[var(--color-accent-50)] hover:text-[var(--color-accent-800)]",
								isOutOfStock && "cursor-not-allowed bg-[var(--color-canvas-deep)]/40 text-[var(--color-ink-400)] opacity-60",
							)}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function ClosestMatchNotice({ brandName, productName, summary, whatsappMessage }: { brandName: string; productName: string; summary: string; whatsappMessage: string }) {
	const { whatsappNumber } = useStoreSettings();
	return (
		<div
			role="status"
			className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent-200)] bg-[var(--color-accent-50)] px-2.5 py-2 text-[11px] text-[var(--color-accent-800)] sm:flex-row sm:items-center sm:justify-between md:text-[12px]"
		>
			<div className="min-w-0">
				<p className="font-semibold leading-tight">Closest match shown</p>
				<p className="mt-0.5 max-w-prose leading-snug">
					We don&apos;t stock this exact combination right now — message us and we&apos;ll source it.
					<span className="sr-only">
						{brandName} {productName}
						{summary ? ` (${summary})` : ""}
					</span>
				</p>
			</div>
			<a
				href={buildWhatsAppLink(whatsappMessage, whatsappNumber)}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-whatsapp)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-on-dark)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-whatsapp-dark)] md:text-[12px]"
			>
				<MessageCircle size={12} className="fill-[var(--color-on-dark)]" />
				Ask on WhatsApp
			</a>
		</div>
	);
}
