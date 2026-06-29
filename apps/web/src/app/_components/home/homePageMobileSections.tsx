import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, MapPin } from "lucide-react";
import { HeroHeadlineWithTrendingProducts } from "@/app/_components/home/HeroTrendingProductBand";
import { ShopTypeCard, type HeroProps, type ProcessSectionProps, type ShopTypesSectionProps, type VisitStoreSectionProps } from "@/app/_components/home/homePageDesktopSections";
import { StoreMapEmbed } from "@/components/shared/StoreMapEmbed";
import { KineticHeading } from "@/components/shared/motion/KineticHeading";
import { MagneticHover } from "@/components/shared/motion/MagneticHover";
import { classNames, getPaymentMethods } from "@store/shared";
import { HOME_FEATURED_CATEGORY_COUNT, formatCategorySectionTitle, getHomeCategoryGridClass, shouldShowBrowseAllCategories } from "@/lib/core/categoryDisplay";
import { SHOP_CATEGORY_PAGE_CLASS } from "@/lib/catalog/shopListingGrid";
import { ShopHeroDealsCta } from "@/app/_components/shop/ShopHeroDealsCta";
import type { HomePageCategory } from "@/lib/core/pageData";

export const MOBILE_CATEGORY_STAGGER_MS = 80;

export function CategorySectionHeadline({ labels }: { labels: string[] }) {
	if (labels.length === 0) {
		return <>Every category.</>;
	}
	/* Each category label sits on its own line. Single-word labels
     (e.g. "Royal", "Coolers") must never break across lines — if the
     container ever gets narrow, the eye expects the label to overflow,
     not to split mid-word. */
	if (labels.length <= 3) {
		return (
			<>
				{labels.map((label) => (
					<span key={label} className="block whitespace-nowrap">
						{label}.
					</span>
				))}
			</>
		);
	}
	return (
		<>
			<span className="block whitespace-nowrap">{labels[0]}.</span>
			<span className="block whitespace-nowrap">{labels[1]}.</span>
			<span className="block whitespace-nowrap text-[var(--color-accent-700)]">& more.</span>
		</>
	);
}

export function MobileShopTypesSection({ categories }: ShopTypesSectionProps) {
	const featured = categories.slice(0, HOME_FEATURED_CATEGORY_COUNT);
	const showBrowseAll = shouldShowBrowseAllCategories(categories.length);
	const headlineLabels = categories.map((category) => category.label);
	const homeCategorySlug = categories.find((category) => category.isActive)?.slug ?? "";

	return (
		<section className="app-section cv-auto">
			<div className="reveal mb-4 text-center">
				<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)]">Explore Collections</p>
				<h2 className="mt-2 text-[1.75rem] font-light leading-[1] tracking-[-0.02em] text-[var(--color-ink-900)]">
					<CategorySectionHeadline labels={headlineLabels} />
				</h2>
				<p className="mx-auto mt-2 max-w-prose text-[13px] leading-relaxed text-[var(--color-ink-600)] font-light">Discover our curated range of cooling solutions tailored for every space.</p>
			</div>
			<div className={`reveal-scroll-list mx-auto ${getHomeCategoryGridClass(featured.length, "mobile")}`}>
				{featured.map((meta) => (
					<ShopTypeCard key={meta.slug} meta={meta} variant="mobile" homeCategorySlug={homeCategorySlug} scrollReveal />
				))}
			</div>
			{showBrowseAll ? (
				<Link
					href="/"
					className="cta-arrow tap mt-4 inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-accent-700)] active:bg-[var(--color-canvas-deep)]"
				>
					Browse all categories
					<ArrowRight size={13} />
				</Link>
			) : null}
		</section>
	);
}

const MOBILE_HERO_GRADIENT = "linear-gradient(180deg, color-mix(in srgb, var(--color-accent-50) 55%, var(--color-canvas)) 0%, var(--color-canvas) 55%, var(--color-canvas) 100%)";

export function MobileHero({ heroProducts, settings, shopHref, showVisitStoreButton = true, showWeAreDifferentCue = true, layout = "viewport", heroDeals = [] }: HeroProps) {
	const productNames = heroProducts.map((product) => product.name);
	const isContentLayout = layout === "content";

	return (
		<section
			className={classNames(
				"relative flex flex-col items-center overflow-hidden text-center",
				!isContentLayout && "reveal-stagger",
				!isContentLayout && "-mx-4 border-b border-[var(--color-ink-100)] px-4",
				"-mt-[var(--mobile-header-h)]",
				isContentLayout ? "pb-8 pt-[calc(var(--mobile-header-h)+1.75rem)] md:pb-10 md:pt-[calc(var(--mobile-header-h)+2.25rem)]" : "justify-evenly pt-[var(--mobile-header-h)]",
			)}
			style={{
				background: MOBILE_HERO_GRADIENT,
				...(isContentLayout ? {} : { minHeight: "calc(100dvh - var(--mobile-tabbar-h))" }),
			}}
		>
			<div
				className={classNames(
					"relative z-10 flex w-full flex-col items-center text-center",
					!isContentLayout && "reveal-stagger",
					isContentLayout ? SHOP_CATEGORY_PAGE_CLASS : "w-full",
				)}
			>
				<div className={classNames("w-full min-w-0 overflow-hidden px-0.5 py-1.5", !isContentLayout && "reveal")}>
					<HeroHeadlineWithTrendingProducts productNames={productNames} variant="mobile" density={isContentLayout ? "compact" : "default"} />
				</div>

				{isContentLayout && heroDeals.length > 0 ? (
					<div className="w-full px-0.5">
						<ShopHeroDealsCta offers={heroDeals} />
					</div>
				) : null}
			</div>

			{showVisitStoreButton ? (
				<div className={classNames("relative z-10 flex w-full flex-col items-center gap-3", !isContentLayout && "reveal")}>
					<MagneticHover strength={0.3} maxOffset={25}>
						<Link
							href={shopHref}
							className="cta-arrow tap inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent-500)] px-6 text-[14px] font-semibold text-[var(--color-ink-900)] shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--color-accent-500)_70%,transparent)] transition-shadow active:bg-[var(--color-accent-600)]"
						>
							Visit store
							<ArrowUpRight size={15} strokeWidth={2.4} />
						</Link>
					</MagneticHover>
				</div>
			) : null}

			{showWeAreDifferentCue ? (
				<a
					href="#how-to-buy"
					aria-label="Scroll to next section"
					className={classNames(
						"hero-scroll-cue tap group relative z-10 inline-flex flex-col items-center gap-1 text-[var(--color-ink-500)] active:text-[var(--color-ink-900)]",
						!isContentLayout && "reveal",
					)}
				>
					<span className="text-[10px] font-semibold uppercase tracking-[0.2em]">We Are Different</span>
					<ChevronDown size={18} strokeWidth={2.2} className="animate-bounce" />
				</a>
			) : null}
		</section>
	);
}

export function MobileProcessSection({ flows }: ProcessSectionProps) {
	return (
		<section id="how-to-buy" className="app-section cv-auto">
			<div className="reveal mb-7 text-center">
				<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">How it works</p>
				<KineticHeading
					as="h2"
					lines={["Three flows", "behind every order"]}
					stagger={0.028}
					className="font-headline mt-2 text-[40px] font-semibold leading-[0.95] tracking-[-0.01em] text-[var(--color-ink-900)] uppercase"
				/>
				<p className="mx-auto mt-3 max-w-prose text-[13px] leading-snug text-[var(--color-ink-500)]">From sourcing to refund — every step on record.</p>
			</div>
			<div className="reveal-scroll-list space-y-4">
				{flows.map((flow) => {
					const Icon = flow.icon;
					return (
						<div
							key={flow.key}
							className="reveal reveal-scroll reveal-rise overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]"
						>
							<div className="flex items-center gap-2.5 bg-[var(--color-ink-900)] px-3.5 py-3 text-[var(--color-canvas)]">
								<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
									<Icon size={14} strokeWidth={2.2} />
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-400)]">{flow.label}</p>
									<p className="text-[13px] font-semibold leading-tight">{flow.caption}</p>
								</div>
							</div>
							<ol className="divide-y divide-[var(--color-ink-100)]">
								{flow.steps.map((step, index) => (
									<li key={step.title} className="flex items-start gap-2.5 px-3.5 py-3">
										<span className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] text-[11px] font-semibold text-[var(--color-accent-800)]">
											{index + 1}
										</span>
										<div className="min-w-0 flex-1">
											<p className="text-[13px] font-semibold leading-tight text-[var(--color-ink-900)]">{step.title}</p>
											<p className="mt-0.5 max-w-prose text-[12px] leading-snug text-[var(--color-ink-600)]">{step.detail}</p>
										</div>
									</li>
								))}
							</ol>
						</div>
					);
				})}
			</div>
		</section>
	);
}

export function MobileVisitStoreSection({ settings }: VisitStoreSectionProps) {
	return (
		<section id="contact" className="app-section cv-auto">
			<div className="reveal mb-7 text-center">
				<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Visit · Call · Chat</p>
				<KineticHeading
					as="h2"
					lines={["Walk in", "or order online"]}
					stagger={0.03}
					className="font-headline mt-2 text-[40px] font-semibold leading-[0.95] tracking-[-0.01em] text-[var(--color-ink-900)] uppercase"
					lineClassNames={["", "text-[var(--color-accent-700)]"]}
				/>
				<p className="mx-auto mt-3 max-w-prose text-[13px] leading-snug text-[var(--color-ink-500)]">
					Visit the store to inspect stock in person — or message us, we ship anywhere in the country.
				</p>
			</div>

			<div className="reveal overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
				<StoreMapEmbed className="aspect-[16/9]" settings={settings} />
				<div className="flex items-start gap-2.5 p-3.5">
					<span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-700)]">
						<MapPin size={14} />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-[14px] font-semibold leading-tight text-[var(--color-ink-900)]">{settings.storeAddressLine1}</p>
						<p className="mt-0.5 text-[12.5px] text-[var(--color-ink-500)]">
							{settings.storeAddressLine2} · {settings.storeHours}
						</p>
					</div>
				</div>

				<div className="space-y-3 border-t border-[var(--color-ink-100)] p-3.5">
					<div>
						<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Payment we accept</p>
						<ul className="mt-1.5 flex flex-wrap gap-1">
							{getPaymentMethods(settings).map((paymentMethod) => (
								<li
									key={paymentMethod.id}
									className="rounded-full border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-2 py-0.5 text-[11px] text-[var(--color-ink-700)]"
								>
									{paymentMethod.label}
								</li>
							))}
						</ul>
					</div>

					<div>
						<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Delivery</p>
						<p className="mt-1 text-[13px] font-semibold text-[var(--color-ink-900)]">Nationwide delivery</p>
						<p className="text-[11.5px] text-[var(--color-ink-500)]">Same-day in-city · 1–3 days nationwide</p>
					</div>
				</div>
			</div>
		</section>
	);
}
