"use client";

import { Clock } from "lucide-react";

import { DealOfferToggleButton } from "@/app/_components/shop/DealOfferButton";
import { DEAL_BUTTONS_LAYOUT_CLASS } from "@/app/_components/shop/dealOfferButtonStyles";
import { DEALS_CATALOG_INTRO } from "@/app/deals/_components/dealsCatalogIntro";
import { StructuredContentFull, hasRenderableContent } from "@/components/shared/StructuredContent";
import { formatRelativeDate, type Offer } from "@store/shared";

interface DealsOffersPanelProps {
	catalogDeals: Offer[];
	activeSlug: string | null;
	onActiveSlugChange: (slug: string) => void;
}

export function DealsOffersPanel({ catalogDeals, activeSlug, onActiveSlugChange }: DealsOffersPanelProps) {
	const activeOffer = catalogDeals.find((offer) => offer.slug === activeSlug) ?? null;

	if (catalogDeals.length === 0) {
		return (
			<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)]/40 px-4 py-6 text-center text-[13px] text-[var(--color-ink-500)]">
				No active offers right now.
			</p>
		);
	}

	return (
		<div className="reveal-scroll-list flex w-full flex-col gap-4 px-0.5 md:items-center md:px-0">
			<h2 className="w-full max-w-md text-center text-[13px] font-normal leading-snug text-pretty text-[var(--color-ink-600)] md:text-[15px]">
				{DEALS_CATALOG_INTRO}
			</h2>

			<div className={DEAL_BUTTONS_LAYOUT_CLASS}>
				{catalogDeals.map((offer) => (
					<DealOfferToggleButton
						key={offer.id}
						offer={offer}
						isActive={activeSlug === offer.slug}
						onToggle={() => onActiveSlugChange(offer.slug)}
					/>
				))}
			</div>

			{activeOffer && hasRenderableContent(activeOffer.content, activeOffer.description) ? (
				<article className="reveal reveal-rise w-full max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 text-left shadow-[0_12px_40px_-28px_color-mix(in_srgb,var(--color-ink-900)_25%,transparent)] md:p-5">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">{activeOffer.discountLabel}</p>
						{activeOffer.expiresAt ? (
							<span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-500)]">
								<Clock size={12} aria-hidden />
								{formatRelativeDate(activeOffer.expiresAt)}
							</span>
						) : null}
					</div>
					<h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--color-ink-900)] md:text-lg">{activeOffer.title}</h3>
					<StructuredContentFull
						content={activeOffer.content}
						fallback={activeOffer.description}
						className="mt-3 text-[13px] leading-snug text-[var(--color-ink-600)]"
						iconColor="var(--color-accent-700)"
						bulletItemClassName="text-[13px] text-[var(--color-ink-700)]"
					/>
				</article>
			) : null}
		</div>
	);
}
