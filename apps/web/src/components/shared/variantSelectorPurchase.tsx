"use client";

import { Check, ShoppingBag } from "lucide-react";

import { formatPrice, classNames } from "@store/shared";

import { Button } from "@store/ui";
import { QuantityStepper } from "@store/ui";

import { formatMissingPrompt } from "./variantSelectorDimensions";

const BUY_ALL_BUTTON_CLASS =
	"tap shrink-0 rounded-[var(--radius-full)] border border-[var(--color-accent-400)] bg-[var(--color-accent-100)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-accent-800)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-200)] active:bg-[var(--color-accent-300)] md:px-3 md:py-1 md:text-[13px]";

export interface PurchaseSummaryProps {
	isComplete?: boolean;
	missingAttributeLabels?: string[];
	minPrice?: number;
	maxPrice?: number;
	isInStock: boolean;
	stockQuantity: number;
	remainingStock: number;
	listPriceRupees: number;
	saleUnitPriceRupees: number;
	quantity: number;
	maxQuantity: number;
	onQuantityChange: (quantity: number) => void;
	onAddToCart: () => void;
	hasJustBeenAdded: boolean;
}

function PriceDisplay({ listPriceRupees, saleUnitPriceRupees }: { listPriceRupees: number; saleUnitPriceRupees: number }) {
	const hasOfferDiscount = saleUnitPriceRupees < listPriceRupees;

	return (
		<div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5">
			{hasOfferDiscount ? <p className="text-[13px] font-medium leading-none text-[var(--color-ink-500)] line-through md:text-[14px]">{formatPrice(listPriceRupees)}</p> : null}
			<p className={classNames("text-xl font-semibold leading-none tracking-tight", hasOfferDiscount ? "text-[var(--color-accent-800)]" : "text-[var(--color-ink-900)]")}>
				{formatPrice(hasOfferDiscount ? saleUnitPriceRupees : listPriceRupees)}
			</p>
		</div>
	);
}

export function PurchaseSummary({
	isComplete = true,
	missingAttributeLabels = [],
	minPrice,
	maxPrice,
	isInStock,
	stockQuantity,
	remainingStock,
	listPriceRupees,
	saleUnitPriceRupees,
	quantity,
	maxQuantity,
	onQuantityChange,
	onAddToCart,
	hasJustBeenAdded,
}: PurchaseSummaryProps) {
	const stockLabel = isInStock ? `${stockQuantity} in stock` : "Sold out";
	const showBuyAll = isInStock && maxQuantity > 1 && quantity < maxQuantity;

	function getButtonLabel() {
		if (!isComplete) return "Select options";
		if (!isInStock) return "Sold out";
		if (maxQuantity <= 0) return "Max in cart";
		if (hasJustBeenAdded) return "Added to cart";
		return "Add to cart";
	}

	const hasPrice = typeof minPrice === "number" && typeof maxPrice === "number";
	const priceLabel = hasPrice ? (minPrice === maxPrice ? formatPrice(minPrice) : `From ${formatPrice(minPrice)}`) : null;

	return (
		<div className="hidden md:block">
			{/* Concentric: inner Button --radius-md (8) + p-2.5 (10) →
          outer 18 ≈ --radius-xl (20, within 2px). */}
			<div className="rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2.5 shadow-[var(--shadow-sm)]">
				<div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						{isComplete ? (
							<>
								<p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-500)] md:text-[13px]">{stockLabel}</p>
								{showBuyAll ? (
									<button type="button" onClick={() => onQuantityChange(maxQuantity)} className={BUY_ALL_BUTTON_CLASS}>
										Buy all
									</button>
								) : null}
							</>
						) : (
							<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-500)]">{formatMissingPrompt(missingAttributeLabels)}</p>
						)}
					</div>
					{isComplete ? (
						<PriceDisplay listPriceRupees={listPriceRupees} saleUnitPriceRupees={saleUnitPriceRupees} />
					) : hasPrice ? (
						<p className="text-xl font-semibold leading-none tracking-tight text-[var(--color-ink-900)]">
							{priceLabel}
						</p>
					) : null}
				</div>

				<div className="mt-2 flex items-center gap-2">
					{isComplete && isInStock ? <QuantityStepper quantity={quantity} max={maxQuantity} onChange={onQuantityChange} size="sm" /> : null}
					<Button
						variant="primary"
						size="sm"
						leadingIcon={hasJustBeenAdded ? <Check size={14} className="animate-badge-pop" /> : <ShoppingBag size={14} />}
						className="min-w-0 flex-1 transition-all duration-300 ease-out-quart"
						disabled={!isComplete || !isInStock || maxQuantity <= 0}
						onClick={onAddToCart}
					>
						{getButtonLabel()}
					</Button>
				</div>
			</div>
		</div>
	);
}

/* ─────────────────────── Mobile sticky CTA ─────────────────────── */

export interface MobileStickyCtaProps {
	isComplete?: boolean;
	missingAttributeLabels?: string[];
	minPrice?: number;
	maxPrice?: number;
	listPriceRupees: number;
	saleUnitPriceRupees: number;
	isInStock: boolean;
	stockQuantity: number;
	remainingStock: number;
	quantity: number;
	maxQuantity: number;
	onQuantityChange: (quantity: number) => void;
	onAddToCart: () => void;
	hasJustBeenAdded: boolean;
}

export function MobileStickyCta({
	isComplete = true,
	missingAttributeLabels = [],
	minPrice,
	maxPrice,
	listPriceRupees,
	saleUnitPriceRupees,
	isInStock,
	stockQuantity,
	remainingStock,
	quantity,
	maxQuantity,
	onQuantityChange,
	onAddToCart,
	hasJustBeenAdded,
}: MobileStickyCtaProps) {
	const showBuyAll = isInStock && maxQuantity > 1 && quantity < maxQuantity;

	function getButtonLabel() {
		if (!isComplete) return "Select options";
		if (!isInStock) return "Sold out";
		if (maxQuantity <= 0) return "Max in cart";
		if (hasJustBeenAdded) return "Added";
		return "Add to cart";
	}

	const hasPrice = typeof minPrice === "number" && typeof maxPrice === "number";
	const priceLabel = hasPrice ? (minPrice === maxPrice ? formatPrice(minPrice) : `From ${formatPrice(minPrice)}`) : null;

	return (
		<div
			className="fixed inset-x-3 z-30 rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2.5 pt-2 shadow-[var(--shadow-lg)] md:hidden"
			style={{
				bottom: "calc(var(--mobile-tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px)",
				paddingBottom: "10px",
			}}
		>
			<div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					{isComplete ? (
						<>
							<p className="text-[12px] font-medium text-[var(--color-ink-500)]">{isInStock ? `${stockQuantity} in stock` : "Sold out"}</p>
							{showBuyAll ? (
								<button type="button" onClick={() => onQuantityChange(maxQuantity)} className={BUY_ALL_BUTTON_CLASS}>
									Buy all
								</button>
							) : null}
						</>
					) : (
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{formatMissingPrompt(missingAttributeLabels)}</p>
					)}
				</div>
				{isComplete ? (
					<PriceDisplay listPriceRupees={listPriceRupees} saleUnitPriceRupees={saleUnitPriceRupees} />
				) : hasPrice ? (
					<p className="text-xl font-semibold leading-none tracking-tight text-[var(--color-ink-900)]">
						{priceLabel}
					</p>
				) : null}
			</div>
			<div className="flex items-center gap-1.5">
				{isComplete && isInStock ? (
					<>
						<QuantityStepper quantity={quantity} max={maxQuantity} onChange={onQuantityChange} size="sm" />
						<button
							type="button"
							onClick={onAddToCart}
							disabled={!isComplete || !isInStock || maxQuantity <= 0}
							aria-live="polite"
							className="tap inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-accent-500)] px-3 text-[12px] font-semibold text-[var(--color-ink-900)] transition-all duration-300 ease-out-quart active:bg-[var(--color-accent-600)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{hasJustBeenAdded ? <Check size={13} className="animate-badge-pop" /> : <ShoppingBag size={13} />}
							{getButtonLabel()}
						</button>
					</>
				) : (
					<span className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-ink-100)] px-3 text-[12px] font-semibold text-[var(--color-ink-500)]">
						{getButtonLabel()}
					</span>
				)}
			</div>
		</div>
	);
}

