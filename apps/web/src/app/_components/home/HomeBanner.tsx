import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HOME_BANNER_TILES } from "@/app/_components/home/homeBannerImages";
import { getStoreSettingsCached, getCategoryBySlugCached, getProductsPageCached } from "@/lib/core/cached";
import type { HomeBannerTile } from "@/app/_components/home/homeBannerImages";
import type { StoreSettings } from "@store/shared";
import { resolveProductHeroImage } from "@/lib/productSummary";

interface HomeBannerProps {
	compact?: boolean;
	categorySlug?: string;
}

export async function HomeBanner({ compact = false, categorySlug }: HomeBannerProps) {
	const settings = await getStoreSettingsCached();
	
	let tiles = HOME_BANNER_TILES.slice(0, compact ? 2 : 3);
	let title: React.ReactNode = (
		<>
			The Art of <br />
			<span className="text-[var(--color-ink-500)]">Cooling.</span>
		</>
	);
	let description = settings.siteTagline || "Curated ceiling, bracket, and pedestal fans. Designed for modern spaces. Engineered for silence.";
	let showLink = true;

	if (categorySlug) {
		const [categoryMeta, productsPage] = await Promise.all([
			getCategoryBySlugCached(categorySlug).catch(() => null),
			getProductsPageCached({ categorySlug: categorySlug, limit: 10 }).catch(() => null)
		]);

		if (categoryMeta) {
			title = <>{categoryMeta.label}</>;
			description = categoryMeta.description;
			showLink = false;
		}

		if (productsPage && productsPage.products.length > 0) {
			const dynamicTiles: HomeBannerTile[] = productsPage.products.map(p => {
				const img = resolveProductHeroImage(p);
				return {
					src: img?.variants.full ?? "",
					alt: img?.alt ?? p.name,
					caption: p.name,
					href: `/${categorySlug}/${p.slug}`
				};
			}).filter(t => t.src !== "");
			
			if (dynamicTiles.length > 0) {
				const requiredTiles = compact ? 2 : 3;
				let filledTiles = [...dynamicTiles];
				// Repeat the dynamic tiles if we don't have enough to fill the gallery,
				// so we only show products from this category, never falling back to generic ones.
				while (filledTiles.length < requiredTiles) {
					filledTiles = [...filledTiles, ...dynamicTiles];
				}
				tiles = filledTiles.slice(0, requiredTiles);
			} else {
				// If no products have images, don't show wrong category images
				tiles = [];
			}
		}
	}

	return (
		<section className={`relative w-full border-b border-[var(--color-ink-100)] pt-[calc(var(--mobile-header-h)+1.5rem)] md:pt-[calc(var(--desktop-header-h)+2rem)]`}>
			<div className={`mx-auto max-w-[1600px] px-6 ${compact ? "pb-6 md:pb-10" : "pb-10 md:px-12 md:pb-16 lg:pb-20"}`}>
				<div className={`grid grid-cols-1 lg:grid-cols-12 ${compact ? "gap-8 lg:gap-12" : "gap-12 lg:gap-20"} items-center`}>
					{/* Left Column: Minimalist Typography */}
					<div className={`lg:col-span-5 ${compact ? "space-y-6" : "space-y-8"}`}>
						<div className="space-y-4">
							<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)]">
								{settings.siteName} Gallery
							</p>
							<h1 className={`${compact ? "text-[2.5rem] sm:text-[3rem]" : "text-[3.5rem] sm:text-[4.5rem] lg:text-[5.5rem]"} font-medium leading-[1] tracking-[-0.03em] text-[var(--color-ink-900)]`}>
								{title}
							</h1>
						</div>

						<p className={`max-w-md ${compact ? "text-[14px]" : "text-[15px] md:text-[17px]"} leading-relaxed text-[var(--color-ink-600)] font-light`}>
							{description}
						</p>

						{showLink && (
							<div className="flex flex-wrap items-center gap-6 pt-4">
								{categorySlug ? (
									<Link
										href="#shop-catalog"
										className="group inline-flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-900)] transition-colors hover:text-[var(--color-ink-600)]"
									>
										<span className="border-b border-[var(--color-ink-900)] pb-1 group-hover:border-[var(--color-ink-600)] transition-colors">
											View Collection
										</span>
										<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
									</Link>
								) : (
									<Link
										href="#shop-catalog"
										className="group inline-flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-900)] transition-colors hover:text-[var(--color-ink-600)]"
									>
										<span className="border-b border-[var(--color-ink-900)] pb-1 group-hover:border-[var(--color-ink-600)] transition-colors">
											View Collection
										</span>
										<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
									</Link>
								)}
							</div>
						)}
					</div>

					{/* Right Column: Art Gallery Layout */}
					<div className="lg:col-span-7">
						<BannerVisualGallery tiles={tiles} compact={compact} />
					</div>
				</div>
			</div>
		</section>
	);
}

function BannerVisualGallery({ tiles, compact }: { tiles: HomeBannerTile[]; compact: boolean }) {
	const [hero, second, third] = tiles;
	if (!hero) return null;

	return (
		<>
			{/* Mobile layout: horizontal scroll */}
			<div className="flex sm:hidden overflow-x-auto snap-x snap-mandatory gap-4 no-scrollbar pb-4 -mx-6 px-6">
				{tiles.map((tile, index) => (
					<div key={index} className="w-[85vw] shrink-0 snap-center group relative overflow-hidden bg-[var(--color-surface)] aspect-[4/3]">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={tile.src}
							alt={tile.alt}
							className="absolute inset-0 h-full w-full object-cover"
							loading={index === 0 ? "eager" : "lazy"}
							fetchPriority={index === 0 ? "high" : "auto"}
						/>
						{tile.caption && (
							<div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
								<div className="bg-white/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-900)]">
									{tile.caption}
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Desktop layout: grid */}
			<div className="hidden sm:grid grid-cols-12 gap-6">
				{/* Main Featured Piece */}
				<div className={`col-span-12 ${compact ? "sm:col-span-6" : "sm:col-span-8"} group relative overflow-hidden bg-[var(--color-surface)] ${compact ? "aspect-[4/3] sm:aspect-square" : "aspect-[4/3] sm:aspect-[4/3]"}`}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={hero.src}
						alt={hero.alt}
						className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
						loading="eager"
						fetchPriority="high"
					/>
					<div className="absolute bottom-6 left-6 right-6 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-500">
						<div className="bg-white/90 backdrop-blur-md px-4 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-900)]">
							{hero.caption}
						</div>
					</div>
				</div>

				{/* Secondary Pieces */}
				<div className={`col-span-12 ${compact ? "sm:col-span-6" : "sm:col-span-4"} flex flex-col gap-6`}>
					{second && (
						<div className={`group relative overflow-hidden bg-[var(--color-surface)] ${compact ? "aspect-[4/3] sm:aspect-square" : "aspect-[4/3] sm:aspect-auto"} flex-1`}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={second.src}
								alt={second.alt}
								className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105 filter grayscale-[20%]"
								loading="lazy"
							/>
						</div>
					)}
					{!compact && third && (
						<div className="group relative overflow-hidden bg-[var(--color-surface)] aspect-[4/3] sm:aspect-auto flex-1">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={third.src}
								alt={third.alt}
								className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
								loading="lazy"
							/>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
