import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getStoreSettingsCached, getCategoryBySlugCached, getProductsPageCached } from "@/lib/core/cached";
import { toYouTubeEmbedUrl, type StoreSettings } from "@store/shared";
import { resolveProductHeroImage } from "@/lib/productSummary";

interface DynamicBannerTile {
	src: string;
	alt: string;
	caption?: string;
	href?: string;
}

interface HomeBannerProps {
	compact?: boolean;
	categorySlug?: string;
}

export async function HomeBanner({ compact = false, categorySlug }: HomeBannerProps) {
	const settings = await getStoreSettingsCached();

	let dynamicTiles: DynamicBannerTile[] = [];
	let title: React.ReactNode = settings.siteName ? <>{settings.siteName}</> : "Chandni Traders";
	let description = settings.siteTagline || "Curated premium collection. Engineered for quality and durability.";
	let showLink = true;

	const hasCustomHero = Boolean(settings.heroMediaUrl?.trim());

	if (categorySlug) {
		const [categoryMeta, productsPage] = await Promise.all([
			getCategoryBySlugCached(categorySlug).catch(() => null),
			getProductsPageCached({ categorySlug: categorySlug, limit: 10 }).catch(() => null),
		]);

		if (categoryMeta) {
			title = <>{categoryMeta.label}</>;
			description = categoryMeta.description;
			showLink = false;
		}

		if (productsPage && productsPage.products.length > 0) {
			const categoryTiles: DynamicBannerTile[] = productsPage.products
				.map((p) => {
					const img = resolveProductHeroImage(p);
					return {
						src: img?.variants.full ?? "",
						alt: img?.alt ?? p.name,
						caption: p.name,
						href: `/${categorySlug}/${p.slug}`,
					};
				})
				.filter((t) => t.src !== "");

			if (categoryTiles.length > 0) {
				const requiredTiles = compact ? 2 : 3;
				let filledTiles = [...categoryTiles];
				// Repeat the dynamic tiles if we don't have enough to fill the gallery,
				// so we only show products from this category, never falling back to generic ones.
				while (filledTiles.length < requiredTiles) {
					filledTiles = [...filledTiles, ...categoryTiles];
				}
				dynamicTiles = filledTiles.slice(0, requiredTiles);
			} else {
				// If no products have images, don't show wrong category images
				dynamicTiles = [];
			}
		}
	}

	return (
		<section className={`relative w-full border-b border-[var(--color-ink-100)] pt-[calc(var(--mobile-header-h)+1.5rem)] md:pt-[calc(var(--desktop-header-h)+2rem)]`}>
			<div className={`mx-auto max-w-[1600px] px-6 ${compact ? "pb-6 md:pb-10" : "pb-10 md:px-12 md:pb-16 lg:pb-20"}`}>
				<div className={`grid grid-cols-1 lg:grid-cols-12 ${compact ? "gap-6 lg:gap-10" : "gap-10 lg:gap-14"} items-center`}>
					{/* Left Column: Minimalist Typography */}
					<div className={`lg:col-span-5 ${compact ? "space-y-5" : "space-y-7"}`}>
						<div className="space-y-3">
							<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-500)]">{settings.siteName} Gallery</p>
							<h1
								className={`${compact ? "text-[2.25rem] sm:text-[2.75rem]" : "text-[3rem] sm:text-[4rem] lg:text-[4.75rem]"} font-medium leading-[1.05] tracking-[-0.03em] text-[var(--color-ink-900)]`}
							>
								{title}
							</h1>
						</div>

						<p className={`max-w-md ${compact ? "text-[14px]" : "text-[15px] md:text-[16px]"} font-light leading-relaxed text-[var(--color-ink-600)]`}>{description}</p>

						{showLink && (
							<div className="flex flex-wrap items-center gap-6 pt-2">
								<Link
									href="#shop-catalog"
									className="group inline-flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-900)] transition-colors hover:text-[var(--color-ink-600)]"
								>
									<span className="border-b border-[var(--color-ink-900)] pb-1 transition-colors group-hover:border-[var(--color-ink-600)]">View Collection</span>
									<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
								</Link>
							</div>
						)}
					</div>

					{/* Right Column: Single Pristine Hero Showcase */}
					<div className="lg:col-span-7">
						<BannerVisualGallery
							tiles={dynamicTiles}
							customMedia={
								hasCustomHero
									? {
											url: settings.heroMediaUrl,
											type: settings.heroMediaType,
											alt: settings.heroMediaAlt,
										}
									: undefined
							}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

interface CustomBannerMedia {
	url: string;
	type: "image" | "video" | "none";
	alt?: string;
}

function BannerVisualGallery({ tiles, customMedia }: { tiles: DynamicBannerTile[]; customMedia?: CustomBannerMedia }) {
	if (customMedia && customMedia.url) {
		const youtubeEmbedUrl = toYouTubeEmbedUrl(customMedia.url);
		const isYouTube = youtubeEmbedUrl !== null;
		const isVideo = customMedia.type === "video" || isYouTube || /\.(mp4|webm)$/i.test(customMedia.url);
		const caption = customMedia.alt?.trim() || "";

		return (
			<div className="relative aspect-[16/10] w-full overflow-hidden rounded-none border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] sm:aspect-[16/10] lg:aspect-[16/10]">
				{isVideo ? (
					isYouTube ? (
						<iframe
							src={`${youtubeEmbedUrl}${youtubeEmbedUrl?.includes("?") ? "&" : "?"}autoplay=1&mute=1&loop=1&playsinline=1&controls=0`}
							title="Hero Banner Video"
							loading="eager"
							referrerPolicy="strict-origin-when-cross-origin"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
							className="pointer-events-none size-full select-none border-0 object-cover"
						/>
					) : (
						<video
							src={customMedia.url}
							autoPlay
							loop
							muted
							playsInline
							preload="auto"
							disablePictureInPicture
							disableRemotePlayback
							tabIndex={-1}
							className="size-full transform-gpu object-cover will-change-transform"
						>
							<source src={customMedia.url} type="video/mp4" />
						</video>
					)
				) : (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img
						src={customMedia.url}
						alt={caption || "Hero Banner"}
						className="size-full object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
						loading="eager"
						fetchPriority="high"
					/>
				)}
				{caption && (
					<div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center justify-between">
						<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]/90 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-900)] shadow-sm backdrop-blur-md">
							{caption}
						</div>
					</div>
				)}
			</div>
		);
	}

	const hero = tiles[0];
	if (!hero) return null;

	return (
		<div className="relative aspect-[16/10] w-full overflow-hidden rounded-none border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] sm:aspect-[16/10] lg:aspect-[16/10]">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={hero.src}
				alt={hero.alt}
				className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
				loading="eager"
				fetchPriority="high"
			/>
			{hero.caption && (
				<div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center justify-between">
					<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]/90 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-900)] shadow-sm backdrop-blur-md">
						{hero.caption}
					</div>
				</div>
			)}
		</div>
	);
}
