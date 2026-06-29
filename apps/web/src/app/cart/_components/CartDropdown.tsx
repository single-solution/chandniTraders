"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, ShoppingBag, Trash2, X } from "lucide-react";
import { ButtonLink } from "@store/ui";
import { QuantityStepper } from "@store/ui";
import { ProductImage } from "@/components/shared/ProductImage";
import { CartLinePrice } from "@/components/shared/CartLinePrice";
import { CheckoutOfferNotices } from "@/components/shared/CheckoutOfferNotices";
import { catalogRootHref, productHref } from "@/lib/catalog/productPaths";
import { useCart } from "@/lib/cart/useCart";
import { useCartOfferPricing } from "@/lib/pricing/useCartOfferPricing";
import { usePresence } from "@/components/shared/motion/usePresence";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";
import { useToast } from "@/components/ui/Toast";
import type { CartItem } from "@/lib/cart/types";
import type { DiscountApplication } from "@store/shared";
import { classNames, formatPrice } from "@store/shared";

interface CartDropdownProps {
	open: boolean;
	onClose: () => void;
}

/** Matches the `popover-out` / `sheet-fade-out` exit duration in globals.css. */
const CART_EXIT_MS = 180;

/* Desktop-only cart popover anchored to the header trigger. Mobile uses
   a dedicated `/cart` page instead, reached via the bottom-bar tab. */
export function CartDropdown({ open, onClose }: CartDropdownProps) {
	const cart = useCart();
	const { pricing, appliedOffers } = useCartOfferPricing();
	const { toast } = useToast();
	const [isHydrated, setIsHydrated] = useState(false);
	const { isMounted: isPresent, status } = usePresence(open, CART_EXIT_MS);
	const isClosing = status === "closing";
	const dialogRef = useRef<HTMLDivElement>(null);

	useFocusTrap(dialogRef, open);

	// Mount-detection flag so we can skip the portal render on the SSR pass
	// and avoid a hydration mismatch. Single setState on mount, never again.
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration detection
		setIsHydrated(true);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [open, onClose]);

	if (!isPresent || !isHydrated) {
		return null;
	}
	const totals = { subtotal: cart.subtotalRupees, itemCount: cart.itemCount, finalTotal: pricing.finalTotal, totalDiscount: pricing.totalDiscount };
	const lines = cart.items;

	const overlay = (
		<>
			<button
				aria-label="Close cart"
				type="button"
				onClick={onClose}
				className={classNames(
					"fixed inset-0 z-[var(--z-overlay)] hidden cursor-default bg-[var(--color-ink-900)]/15 md:block",
					isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade",
				)}
			/>
			<div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-modal)] hidden justify-center px-6 pt-[calc(var(--desktop-header-h)+8px)] md:flex lg:px-8">
				<div className="flex w-full max-w-[1440px] justify-end">
					<div
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-label="Your cart"
						tabIndex={-1}
						className={classNames(
							/* Drops down + scales in from the header cart trigger so
                 the panel feels anchored to its button. */
							"pointer-events-auto flex h-[min(620px,calc(100dvh-var(--desktop-header-h)-32px))] w-[400px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] outline-none",
							isClosing ? "animate-popover-out" : "animate-popover-in",
						)}
					>
						<header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-ink-100)] px-4 py-3">
							<div className="min-w-0">
								<p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Your cart</p>
								<h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-ink-900)]">
									{totals.itemCount} {totals.itemCount === 1 ? "item" : "items"}
								</h2>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close cart"
								className="tap focus-ring grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)]"
							>
								<X size={16} />
							</button>
						</header>

						{lines.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
								<span className="grid size-12 place-items-center rounded-full bg-[var(--color-accent-50)] text-[var(--color-accent-700)]">
									<ShoppingBag size={20} />
								</span>
								<p className="text-[14px] font-semibold text-[var(--color-ink-900)]">Your cart is empty</p>
								<p className="max-w-prose text-[12.5px] text-[var(--color-ink-500)]">Add a product from the shop to get started.</p>
								<ButtonLink href={catalogRootHref()} variant="primary" size="sm" onClick={onClose}>
									Browse products
								</ButtonLink>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
								<div className="min-h-0 flex-1 overflow-y-auto">
									{appliedOffers.length > 0 ? (
										<div className="border-b border-[var(--color-ink-100)] px-3 py-2">
											<CheckoutOfferNotices appliedOffers={appliedOffers} />
										</div>
									) : null}
									<ul className="sheet-stagger divide-y divide-[var(--color-ink-100)] px-1">
										{lines.map((line) => (
											<CartDropdownLine
												key={line.id}
												line={line}
												discounts={pricing.itemDiscounts.get(line.id) || []}
												onClose={onClose}
												onRemove={() => {
													cart.removeItem(line.id);
													toast(`${line.productName} removed`, { tone: "info" });
												}}
												onQuantityChange={(next) => cart.updateQuantity(line.id, next)}
											/>
										))}
									</ul>
								</div>

								<div className="shrink-0 border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-4 py-4">
									<div className="flex items-baseline justify-between">
										<span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Subtotal</span>
										<span className="text-[14px] font-semibold tabular-nums tracking-tight text-[var(--color-ink-900)]">{formatPrice(totals.subtotal)}</span>
									</div>
									{totals.totalDiscount > 0 && (
										<div className="mt-1.5 flex items-baseline justify-between">
											<span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-700)]">Discounts</span>
											<span className="text-[14px] font-semibold tabular-nums tracking-tight text-[var(--color-accent-700)]">-{formatPrice(totals.totalDiscount)}</span>
										</div>
									)}
									<div className="mt-1.5 flex items-baseline justify-between">
										<span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Total</span>
										<span className="font-headline text-[22px] font-semibold tabular-nums tracking-tight text-[var(--color-ink-900)]">{formatPrice(totals.finalTotal)}</span>
									</div>
									<p className="mt-0.5 text-[11px] text-[var(--color-ink-500)]">Delivery &amp; payment chosen at checkout.</p>
									<ButtonLink href="/checkout" variant="primary" size="md" className="mt-3 w-full" onClick={onClose} trailingIcon={<ArrowUpRight size={15} strokeWidth={2.4} />}>
										Proceed to checkout
									</ButtonLink>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);

	return createPortal(overlay, document.body);
}

interface CartDropdownLineProps {
	line: CartItem;
	discounts?: DiscountApplication[];
	onClose: () => void;
	onQuantityChange: (quantity: number) => void;
	onRemove: () => void;
}

function CartDropdownLine({ line, discounts = [], onClose, onQuantityChange, onRemove }: CartDropdownLineProps) {
	const [isRemoving, setIsRemoving] = useState(false);
	const { quantity, productName, brandName, brandSlug, image } = line;
	const lineTotal = line.unitPriceRupees * quantity;
	const cartSelection: Record<string, string> = {};
	for (const [slug, value] of Object.entries(line.attributes ?? {})) {
		const resolved = Array.isArray(value) ? value[0] : value;
		if (resolved) {
			cartSelection[slug] = resolved;
		}
	}
	const lineProductHref =
		line.categorySlug && line.productSlug ? productHref({ categorySlug: line.categorySlug, slug: line.productSlug }, { selection: cartSelection }) : catalogRootHref();
	const attributeEntries = Object.entries(line.attributes ?? {});

	const handleRemove = () => {
		setIsRemoving(true);
		setTimeout(() => {
			onRemove();
		}, 320); // matches --motion-slow for item-out animation
	};

	return (
		<li className="group flex items-start gap-3 px-3 py-3" data-item-state={isRemoving ? "removing" : undefined}>
			<Link
				href={lineProductHref}
				onClick={onClose}
				className="product-media-well relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)]"
			>
				<div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.05]">
					<ProductImage image={image} variant="thumb" name={productName} brandName={brandName} brandSlug={brandSlug} sizes="64px" />
				</div>
			</Link>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{brandName}</p>
						<Link
							href={lineProductHref}
							onClick={onClose}
							className="line-clamp-2 text-[14.5px] font-semibold leading-snug tracking-tight text-[var(--color-ink-900)] hover:text-[var(--color-accent-800)]"
						>
							{productName}
						</Link>
					</div>
					<button
						type="button"
						onClick={handleRemove}
						aria-label={`Remove ${productName}`}
						className="tap focus-ring grid size-7 shrink-0 place-items-center rounded-full text-[var(--color-ink-400)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-danger-500)]"
					>
						<Trash2 size={13} />
					</button>
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-[var(--color-ink-700)]">
					{attributeEntries.map(([attrKey, value]) => (
						<span
							key={attrKey}
							className="inline-flex items-center rounded-[var(--radius-full)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium"
						>
							{value}
						</span>
					))}
				</div>
				<div className="mt-2.5 flex items-center justify-between gap-2">
					<QuantityStepper quantity={quantity} max={line.maxQuantity ?? 10} onChange={onQuantityChange} size="sm" />
					<CartLinePrice lineTotalRupees={lineTotal} discounts={discounts} lockedOfferTitle={line.appliedOffer?.title} />
				</div>
			</div>
		</li>
	);
}
