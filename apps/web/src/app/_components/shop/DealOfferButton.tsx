import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { HeroDealBadge, PRIMARY_DEAL_BUTTON_CLASS } from "@/app/_components/shop/dealOfferButtonStyles";
import { classNames, type Offer } from "@store/shared";

interface DealOfferButtonLinkProps {
	offer: Offer;
	href: string;
	trailingLabel?: string;
	className?: string;
}

function DealOfferButtonContent({
	offer,
	trailing,
}: {
	offer: Offer;
	trailing: ReactNode;
}) {
	return (
		<>
			<span className="flex min-w-0 items-center justify-between gap-1 md:contents">
				<HeroDealBadge label={offer.badgeLabel} />
				<span className="shrink-0 md:order-last md:inline-flex">{trailing}</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5 md:contents">
				<span className="text-[13px] font-extrabold leading-none text-[var(--color-accent-700)] md:text-sm">{offer.discountLabel}</span>
				<span className="line-clamp-2 text-[11px] font-medium leading-snug text-[var(--color-ink-800)] md:line-clamp-none md:text-[13px] md:text-center">
					{offer.title}
				</span>
			</span>
		</>
	);
}

export function DealOfferButtonLink({ offer, href, trailingLabel = "View", className }: DealOfferButtonLinkProps) {
	return (
		<Link href={href} className={classNames(PRIMARY_DEAL_BUTTON_CLASS, className)}>
			<DealOfferButtonContent
				offer={offer}
				trailing={
					<span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold md:order-last">
						{trailingLabel}
						<ArrowUpRight size={15} strokeWidth={2.4} aria-hidden />
					</span>
				}
			/>
		</Link>
	);
}

interface DealOfferToggleButtonProps {
	offer: Offer;
	isActive: boolean;
	onToggle: () => void;
}

export function DealOfferToggleButton({ offer, isActive, onToggle }: DealOfferToggleButtonProps) {
	return (
		<button
			type="button"
			id={offer.slug}
			aria-pressed={isActive}
			onClick={onToggle}
			className={classNames(
				PRIMARY_DEAL_BUTTON_CLASS,
				isActive &&
					"ring-2 ring-[var(--color-accent-700)] ring-offset-2 ring-offset-[var(--color-canvas)] max-md:ring-inset max-md:ring-offset-0",
			)}
		>
			<DealOfferButtonContent
				offer={offer}
				trailing={
					<span
						className={classNames(
							"inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold md:gap-1 md:text-xs",
							isActive ? "text-[var(--color-accent-900)]" : "text-[var(--color-ink-700)]",
						)}
					>
						{isActive ? (
							<>
								<Check size={13} strokeWidth={2.6} aria-hidden className="md:h-3.5 md:w-3.5" />
								<span className="hidden md:inline">Selected</span>
								<span className="md:hidden">On</span>
							</>
						) : (
							"Select"
						)}
					</span>
				}
			/>
		</button>
	);
}
