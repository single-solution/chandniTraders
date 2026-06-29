import { Sparkles } from "lucide-react";

import { StorefrontOfferNotices } from "@/components/shared/StorefrontOfferNotices";
import { SHOP_CATEGORY_PAGE_CLASS } from "@/lib/catalog/shopListingGrid";
import type { Offer } from "@store/shared";

const DEALS_HEADER_GRADIENT =
	"linear-gradient(180deg, color-mix(in srgb, var(--color-accent-50) 58%, var(--color-canvas)) 0%, var(--color-canvas) 62%, var(--color-canvas) 100%)";

interface DealsPageHeaderProps {
	checkoutNotices?: Offer[];
}

export function DealsPageHeader({ checkoutNotices = [] }: DealsPageHeaderProps) {
	return (
		<section
			className="-mt-[var(--mobile-header-h)] pb-6 pt-[calc(var(--mobile-header-h)+1.75rem)] text-center md:-mt-[var(--desktop-header-h)] md:pb-8 md:pt-[calc(var(--desktop-header-h)+2.5rem)]"
			style={{ background: DEALS_HEADER_GRADIENT }}
		>
			<div className={`reveal mx-auto flex w-full flex-col items-center ${SHOP_CATEGORY_PAGE_CLASS}`}>
				<p className="inline-flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)] md:text-xs">
					<Sparkles size={12} aria-hidden />
					Live offers
				</p>
				<h1 className="font-headline mt-3 w-full text-center text-[32px] font-semibold leading-[0.95] tracking-[-0.02em] text-[var(--color-ink-900)] uppercase md:mt-4 md:text-5xl">
					Today&apos;s deals
				</h1>
				{checkoutNotices.length > 0 ? (
					<div className="mt-4 w-full md:mt-5">
						<StorefrontOfferNotices offers={checkoutNotices} />
					</div>
				) : null}
			</div>
		</section>
	);
}
