import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Clock, MapPin, Sparkles } from "lucide-react";
import { classNames } from "@store/shared";
import { ButtonLink } from "@store/ui";
import { Icon } from "@/components/shared/Icon";
import { StructuredContentCompact, StructuredContentFull } from "@/components/shared/StructuredContent";
import { HeroHeadlineWithTrendingProducts } from "@/app/_components/home/HeroTrendingProductBand";
import type { ProcessFlow } from "@/app/_components/home/homeProcessFlows";
import { KineticHeading } from "@/components/shared/motion/KineticHeading";
import { MagneticHover } from "@/components/shared/motion/MagneticHover";
import { SectionAmbience } from "@/components/shared/motion/SectionAmbience";
import { StoreMapEmbed } from "@/components/shared/StoreMapEmbed";
import { getPaymentMethods, type Product, type Offer, type StoreSettings } from "@store/shared";
import { ShopHeroDealsCta } from "@/app/_components/shop/ShopHeroDealsCta";
import { SHOP_CATEGORY_PAGE_CLASS } from "@/lib/catalog/shopListingGrid";
import { HOME_FEATURED_CATEGORY_COUNT, formatCategorySectionTitle, getHomeCategoryGridClass, shouldShowBrowseAllCategories } from "@/lib/core/categoryDisplay";
import { homeCategoryHref } from "@/lib/catalog/homeCategoryHref";
import type { HomePageCategory } from "@/lib/core/pageData";

export const DESKTOP_CATEGORY_STAGGER_MS = 100;

/** Google Maps zoom level used in the embedded store-locator iframe — 17
 *  reads as "street level" without showing individual building outlines. */
const MAP_EMBED_ZOOM = 17;

export interface HeroProps {
	heroProducts: Product[];
	settings: StoreSettings;
	/** Storefront catalog entry — `/` or `/?category=…` for the default category. */
	shopHref: string;
	showVisitStoreButton?: boolean;
	showWeAreDifferentCue?: boolean;
	/** `viewport` fills the screen (About). `content` sizes to its children (shop banner). */
	layout?: "viewport" | "content";
	/** Live storefront offers — drives the deals CTA under the headline on shop banners. */
	heroDeals?: Offer[];
}

export interface ShopTypesSectionProps {
	categories: HomePageCategory[];
}

export interface ProcessSectionProps {
	flows: ProcessFlow[];
}

export interface VisitStoreSectionProps {
	settings: StoreSettings;
}

const DESKTOP_HERO_GRADIENT = "linear-gradient(180deg, color-mix(in srgb, var(--color-accent-50) 60%, var(--color-canvas)) 0%, var(--color-canvas) 60%, var(--color-canvas) 100%)";

export function DesktopHero({ heroProducts, settings, shopHref, showVisitStoreButton = true, showWeAreDifferentCue = true, layout = "viewport", heroDeals = [] }: HeroProps) {
	const productNames = heroProducts.map((product) => product.name);
	const isContentLayout = layout === "content";

	return (
		<section
			data-magnetic-field
			className={classNames(
				"relative flex overflow-hidden",
				!isContentLayout && "border-b border-[var(--color-ink-100)]",
				"-mt-[var(--desktop-header-h)]",
				isContentLayout ? "flex-col pb-8 pt-[calc(var(--desktop-header-h)+2rem)] md:pb-10 md:pt-[calc(var(--desktop-header-h)+2.5rem)]" : "flex-col pt-[var(--desktop-header-h)]",
			)}
			style={{
				background: DESKTOP_HERO_GRADIENT,
				...(isContentLayout ? {} : { minHeight: "100dvh" }),
			}}
		>
			<div
				className={classNames(
					"relative z-10 flex w-full flex-col items-center text-center",
					!isContentLayout && "reveal-stagger",
					isContentLayout ? SHOP_CATEGORY_PAGE_CLASS : "mx-auto max-w-5xl justify-evenly px-6",
				)}
				style={isContentLayout ? undefined : { minHeight: "calc(100dvh - var(--desktop-header-h))" }}
			>
				<div className={classNames("w-full overflow-hidden px-0.5 py-1.5", !isContentLayout && "reveal")}>
					<HeroHeadlineWithTrendingProducts productNames={productNames} variant="desktop" density={isContentLayout ? "compact" : "default"} />
				</div>

				{isContentLayout && heroDeals.length > 0 ? (
					<div className="w-full px-0.5">
						<ShopHeroDealsCta offers={heroDeals} />
					</div>
				) : null}

				{showVisitStoreButton ? (
					<div className={classNames("flex flex-col items-center gap-6", !isContentLayout && "reveal")}>
						<MagneticHover fieldSelector="[data-magnetic-field]" strength={0.2} maxOffset={30}>
							<ButtonLink
								href={shopHref}
								variant="primary"
								size="lg"
								className="cta-arrow !rounded-full shadow-[0_12px_36px_-16px_color-mix(in_srgb,var(--color-accent-500)_75%,transparent)]"
								trailingIcon={<ArrowUpRight size={17} strokeWidth={2.4} />}
							>
								Visit store
							</ButtonLink>
						</MagneticHover>
					</div>
				) : null}

				{showWeAreDifferentCue ? (
					<div className={!isContentLayout ? "reveal" : undefined}>
						<a
							href="#how-to-buy"
							aria-label="Scroll to next section"
							className="hero-scroll-cue tap group inline-flex flex-col items-center gap-1 text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
						>
							<span className="text-[10px] font-semibold uppercase tracking-[0.2em]">We Are Different</span>
							<ChevronDown size={20} strokeWidth={2.2} className="animate-bounce" />
						</a>
					</div>
				) : null}
			</div>
		</section>
	);
}

/**
 * Desktop "Browse by category" section — sits between the hero and the
 * process narrative. Slimmer than the /shop landing chooser (this is a
 * teaser, not the storefront). Each card links into its respective category.
 */
export function DesktopShopTypesSection({ categories }: ShopTypesSectionProps) {
	const featured = categories.slice(0, HOME_FEATURED_CATEGORY_COUNT);
	const showBrowseAll = shouldShowBrowseAllCategories(categories.length);
	const headlineLabels = categories.map((category) => category.label);
	const homeCategorySlug = categories.find((category) => category.isActive)?.slug ?? "";

	return (
		<section className="cv-auto relative mx-auto w-full max-w-[1440px] overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
			<SectionAmbience intensity="soft" side="right" />
			<div className="relative z-10 reveal">
				<DesktopSectionHeader
					align="center"
					eyebrow="Explore Collections"
					title={formatCategorySectionTitle(headlineLabels)}
					description="Discover our curated range of cooling solutions tailored for every space."
				/>
			</div>
			<div className={`relative z-10 mx-auto mt-12 reveal-scroll-list ${getHomeCategoryGridClass(featured.length, "desktop")}`}>
				{featured.map((meta) => (
					<ShopTypeCard key={meta.slug} meta={meta} variant="desktop" homeCategorySlug={homeCategorySlug} scrollReveal />
				))}
			</div>
			{showBrowseAll ? (
				<div className="relative z-10 reveal mt-8 text-center">
					<Link
						href="/"
						className="cta-arrow tap inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-5 py-2.5 text-[14px] font-semibold text-[var(--color-accent-700)] hover:border-[var(--color-ink-300)]"
					>
						Browse all categories
						<ArrowRight size={14} />
					</Link>
				</div>
			) : null}
		</section>
	);
}

/**
 * Shared warm gradient for category cards until per-category accents are authored in admin.
 */
const SHOP_TYPE_DEFAULT_GRADIENT = "from-[var(--color-accent-100)] via-[var(--color-accent-50)] to-[var(--color-canvas)]";

export interface ShopTypeCardProps {
	meta: HomePageCategory;
	variant: "mobile" | "desktop";
	delayMs?: number;
	homeCategorySlug: string;
	scrollReveal?: boolean;
}

export function ShopTypeCard({ meta, variant, delayMs = 0, homeCategorySlug, scrollReveal = false }: ShopTypeCardProps) {
	const isActive = meta.isActive;

	const inner = (
		<div
			/* Concentric radii: mobile inner --radius-lg (14) + p-3.5 (14) →
         outer 28 ≈ --radius-2xl (24, within 2px). Desktop inner
         --radius-lg (14) + p-6 (24) → outer 38 ≈ --radius-3xl (32,
         within 6px). See radius table in globals.css. */
			className={`reveal lift relative flex h-full overflow-hidden border bg-gradient-to-br ${SHOP_TYPE_DEFAULT_GRADIENT} ${scrollReveal ? "reveal-scroll reveal-rise" : ""} ${
				isActive ? "border-[var(--color-ink-100)] hover:border-[var(--color-ink-200)]" : "cursor-not-allowed border-dashed border-[var(--color-ink-200)] opacity-80"
			} ${variant === "desktop" ? "min-h-[240px] flex-col rounded-[var(--radius-3xl)] p-6" : "min-h-[110px] flex-row items-center gap-3 rounded-[var(--radius-2xl)] p-3.5"}`}
			style={scrollReveal ? undefined : { ["--reveal-delay" as string]: `${delayMs}ms` }}
		>
			<span
				className={`grid shrink-0 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-accent-400)]/25 bg-[var(--color-accent-500)]/10 text-[var(--color-accent-800)] ${
					variant === "desktop" ? "size-12 p-2.5" : "size-11 p-2"
				}`}
				aria-hidden
			>
				<ShopTypeIcon category={meta} />
			</span>

			<div className={variant === "desktop" ? "mt-4 flex-1 flex flex-col" : "min-w-0 flex-1"}>
				<div className="flex items-center justify-between gap-2">
					<h3 className={`font-semibold tracking-tight text-[var(--color-ink-900)] ${variant === "desktop" ? "text-2xl" : "text-[16px]"}`}>{meta.label}</h3>
					{!isActive && (
						<span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-500)]">
							<Clock size={10} /> Soon
						</span>
					)}
				</div>
				<StructuredContentCompact
					content={meta.content}
					fallback={meta.description}
					clampLines={variant === "desktop" ? 3 : 2}
					className={`mt-1 leading-snug text-[var(--color-ink-700)] ${variant === "desktop" ? "text-[14px]" : "text-[12.5px]"}`}
				/>
				{meta.content?.bullets?.length ? (
					<StructuredContentFull
						content={{ summary: "", bullets: meta.content.bullets }}
						maxBullets={variant === "desktop" ? 3 : 2}
						iconColor="var(--color-accent-700)"
						iconSize={variant === "desktop" ? 13 : 12}
						iconSizeClass={variant === "desktop" ? "size-[13px]" : "size-3"}
						className={variant === "desktop" ? "mt-3" : "mt-2"}
						bulletItemClassName={variant === "desktop" ? "text-[13px] text-[var(--color-ink-700)]" : "text-[12px] text-[var(--color-ink-700)]"}
					/>
				) : null}

				<div className={variant === "desktop" ? "mt-auto pt-4" : "mt-1.5"}>
					<span
						className={`cta-arrow inline-flex items-center gap-1 font-semibold ${
							isActive ? "text-[var(--color-accent-700)]" : "text-[var(--color-ink-500)]"
						} ${variant === "desktop" ? "text-[12.5px]" : "text-[12px]"}`}
					>
						{isActive ? `Browse ${meta.label.toLowerCase()}` : "Notify me"}
						<ArrowUpRight size={12} strokeWidth={2.4} />
					</span>
				</div>
			</div>
		</div>
	);

	if (!isActive) {
		return inner;
	}
	return (
		<Link href={homeCategoryHref(meta.slug, homeCategorySlug)} className="tap group block focus:outline-none">
			{inner}
		</Link>
	);
}

export function ShopTypeIcon({ category }: { category: HomePageCategory }) {
	return <Icon node={category.iconNode} className="size-full" />;
}

export function DesktopProcessSection({ flows }: ProcessSectionProps) {
	return (
		<section id="how-to-buy" className="cv-auto relative mx-auto w-full max-w-[1440px] scroll-mt-[var(--desktop-header-h)] overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
			<SectionAmbience intensity="soft" side="left" />
			<div className="relative z-10">
				<div className="reveal">
					<DesktopSectionHeader eyebrow="How it works" title="Three flows behind every order." description="From sourcing to refund — every step on record." />
				</div>
				<div className="reveal-scroll-list mt-12 grid grid-cols-3 gap-4">
					{flows.map((flow) => {
						const Icon = flow.icon;
						return (
							<div
								key={flow.key}
								className="reveal reveal-scroll reveal-rise flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] transition-shadow hover:shadow-[var(--shadow-md)]"
							>
								<div className="flex items-center gap-3 bg-[var(--color-ink-900)] px-6 py-4 text-[var(--color-canvas)]">
									<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
										<Icon size={16} strokeWidth={2.2} />
									</span>
									<div className="min-w-0">
										<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-400)]">{flow.label}</p>
										<p className="text-[14px] font-semibold leading-tight">{flow.caption}</p>
									</div>
								</div>
								<ol className="flex flex-1 flex-col gap-4 p-6">
									{flow.steps.map((step, index) => (
										<li key={step.title} className="flex items-start gap-3">
											<span className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] text-[12px] font-semibold text-[var(--color-accent-800)]">
												{index + 1}
											</span>
											<div className="min-w-0 flex-1 leading-snug">
												<p className="text-[14px] font-semibold text-[var(--color-ink-900)]">{step.title}</p>
												<p className="mt-0.5 max-w-prose text-[12.5px] text-[var(--color-ink-600)]">{step.detail}</p>
											</div>
										</li>
									))}
								</ol>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}

export function DesktopVisitStore({ settings }: VisitStoreSectionProps) {
	return (
		<section id="contact" className="cv-auto relative mx-auto w-full max-w-[1440px] overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
			<SectionAmbience intensity="soft" side="right" />
			<div className="relative z-10 reveal overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
				<div className="grid grid-cols-[1.15fr_1fr]">
					<div className="flex flex-col gap-7 p-10">
						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Visit · Call · Chat</p>
							<KineticHeading
								as="h2"
								lines={["Walk in", "or order online"]}
								stagger={0.026}
								className="font-headline text-[72px] font-semibold leading-[0.92] tracking-[-0.015em] text-[var(--color-ink-900)] uppercase"
							/>
							<p className="max-w-prose text-base text-[var(--color-ink-600)]">
								Visit the store to inspect stock in person and walk out the same day. Prefer to order? Message us and we&apos;ll ship anywhere in the country.
							</p>
						</div>

						{/* Concentric: inner --radius-md (8) + p-4 (16) → outer
                --radius-2xl (24). */}
						<div className="rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] p-4">
							<div className="flex items-start gap-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
									<MapPin size={16} />
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-[var(--color-ink-900)]">{settings.storeAddressLine1}</p>
									<p className="text-sm text-[var(--color-ink-600)]">{settings.storeAddressLine2}</p>
									<p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{settings.storeHours}</p>
								</div>
								<Link
									href={settings?.socialGoogleMaps ?? "#"}
									target="_blank"
									rel="noopener noreferrer"
									className="cta-arrow tap inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-800)] transition-colors hover:border-[var(--color-accent-500)] hover:text-[var(--color-accent-700)]"
								>
									Maps
									<ArrowRight size={12} />
								</Link>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">Payment we accept</p>
								<ul className="mt-2 flex flex-wrap gap-1.5">
									{getPaymentMethods(settings).map((paymentMethod) => (
										<li
											key={paymentMethod.id}
											className="rounded-full border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-ink-700)]"
										>
											{paymentMethod.label}
										</li>
									))}
								</ul>
							</div>
							<div>
								<p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">Delivery</p>
								<p className="mt-2 text-sm font-semibold text-[var(--color-ink-900)]">Nationwide delivery</p>
								<p className="mt-0.5 text-xs text-[var(--color-ink-500)]">Same-day in-city · 1–3 days nationwide</p>
							</div>
						</div>
					</div>
					<StoreMapEmbed className="min-h-[420px]" settings={settings} />
				</div>
			</div>
		</section>
	);
}

export interface DesktopSectionHeaderProps {
	eyebrow: string;
	title: string;
	description: string;
	ctaHref?: string;
	ctaLabel?: string;
	align?: "start" | "center";
}

export function DesktopSectionHeader({ eyebrow, title, description, ctaHref, ctaLabel, align = "start" }: DesktopSectionHeaderProps) {
	const isCentered = align === "center";

	return (
		<div className={isCentered ? "mx-auto max-w-3xl text-center" : "flex items-end justify-between gap-6"}>
			<div className={isCentered ? undefined : "max-w-2xl"}>
				<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)]">{eyebrow}</p>
				<KineticHeading
					as="h2"
					lines={title}
					stagger={0.028}
					className="mt-4 text-[2.5rem] font-light leading-[1] tracking-[-0.02em] text-[var(--color-ink-900)] md:text-[3.5rem]"
				/>
				<p className={`mt-4 max-w-prose text-[14px] leading-relaxed text-[var(--color-ink-600)] md:text-[15px] font-light ${isCentered ? "mx-auto" : ""}`}>{description}</p>
			</div>
			{!isCentered && Boolean(ctaHref) && Boolean(ctaLabel) && (
				<Link
					href={ctaHref!}
					className="cta-arrow tap inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
				>
					{ctaLabel}
					<ArrowRight size={14} />
				</Link>
			)}
		</div>
	);
}
