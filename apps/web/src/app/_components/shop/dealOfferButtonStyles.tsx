import { classNames } from "@store/shared";

/** Mobile: 2-col tile grid. Desktop: centered pill row. */
export const DEAL_BUTTONS_LAYOUT_CLASS =
	"grid w-full grid-cols-2 gap-2 md:flex md:flex-row md:flex-wrap md:items-stretch md:justify-center md:gap-2.5 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-[calc(50%-0.25rem)] md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:w-auto";

export const DEAL_BUTTON_CLASS =
	"tap flex min-h-[5.25rem] min-w-0 w-full flex-col gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-2.5 text-left text-[var(--color-ink-900)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:min-h-0 md:inline-flex md:h-auto md:w-fit md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-2 md:gap-y-1 md:rounded-full md:px-3 md:py-2 md:text-center";

export const PRIMARY_DEAL_BUTTON_CLASS = classNames(
	DEAL_BUTTON_CLASS,
	"border-[var(--color-accent-400)] bg-[var(--color-accent-500)] shadow-[0_8px_24px_-14px_color-mix(in_srgb,var(--color-accent-500)_65%,transparent)] hover:bg-[var(--color-accent-400)] focus-visible:ring-[var(--color-accent-400)]",
);

export const SECONDARY_DEAL_BUTTON_CLASS = classNames(
	DEAL_BUTTON_CLASS,
	"border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[13px] font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-ink-300)] hover:text-[var(--color-ink-900)] focus-visible:ring-[var(--color-ink-200)]",
);

/** PDP offer info — home pill shape, deals-page notice colors (not CTA fill). */
export const PDP_INFO_OFFER_PILL_CLASS = classNames(
	DEAL_BUTTON_CLASS,
	"border-[var(--color-accent-200)] bg-[var(--color-accent-50)] focus-visible:ring-[var(--color-accent-300)]",
);

export const PDP_INFO_OFFER_PILL_APPLIED_CLASS =
	"border-[var(--color-accent-300)] bg-[var(--color-accent-100)]/80 ring-2 ring-[var(--color-accent-400)] ring-offset-2 ring-offset-[var(--color-canvas)]";

/** Checkout/cart notices — full-width rows on mobile; not the deal button grid. */
export const DEAL_NOTICES_LAYOUT_CLASS = "flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-2.5";

/** Soft notice chip — single line, squared corners, not accent button fill. */
export const DEAL_NOTICE_CHIP_CLASS =
	"flex min-w-0 w-full flex-row flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-md)] border border-[var(--color-accent-200)] bg-[var(--color-accent-50)] px-3 py-2 text-left md:w-fit";

export const DEAL_NOTICE_CHIP_APPLIED_CLASS =
	"border-[var(--color-accent-300)] bg-[var(--color-accent-100)]/80 ring-2 ring-[var(--color-accent-400)] ring-offset-2 ring-offset-[var(--color-canvas)]";

export function DealNoticeChipContent({
	badgeLabel,
	discountLabel,
	title,
}: {
	badgeLabel: string;
	discountLabel: string;
	title: string;
}) {
	return (
		<>
			<NoticeDealBadge label={badgeLabel} />
			<span className="shrink-0 text-[12px] font-bold leading-none text-[var(--color-accent-800)] md:text-[13px]">{discountLabel}</span>
			<span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-snug text-[var(--color-ink-700)] md:max-w-[14rem] md:text-[13px] lg:max-w-[18rem]">
				{title}
			</span>
		</>
	);
}

function NoticeDealBadge({ label }: { label: string }) {
	return (
		<span className="inline-flex shrink-0 items-center rounded-sm bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-800)]">
			{label}
		</span>
	);
}

export function HeroDealBadge({ label }: { label: string }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-accent-100)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-800)]">
			{label}
		</span>
	);
}
