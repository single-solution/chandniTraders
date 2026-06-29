import type { Metadata } from "next";
import { Suspense } from "react";

import { logger, classNames } from "@store/shared";

import { DealsCatalog } from "@/app/deals/_components/DealsCatalog";
import { DealsPageHeader } from "@/app/deals/_components/DealsPageHeader";
import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { SHOP_CATEGORY_GRID_CLASS, SHOP_CATEGORY_PAGE_CLASS, SHOP_CATEGORY_SKELETON_CARDS } from "@/lib/catalog/shopListingGrid";
import { DEALS_PRODUCT_PAGE_SIZE, loadDealsPageContent, type DealsPageContent } from "@/lib/pricing/dealsPageContent";
import { DEAL_BUTTONS_LAYOUT_CLASS } from "@/app/_components/shop/dealOfferButtonStyles";
import { getSeoSettings } from "@/lib/seo/seoSettings";

async function loadDealsContentSafe(): Promise<DealsPageContent> {
	try {
		return await loadDealsPageContent();
	} catch (error) {
		logger.error({ error }, "deals: content load failed, falling back to empty layout");
		return { catalogDeals: [], checkoutNotices: [], productPage: { products: [], total: 0, page: 1, pageSize: DEALS_PRODUCT_PAGE_SIZE, pageCount: 1 } };
	}
}

export async function generateMetadata(): Promise<Metadata> {
	const seo = await getSeoSettings();
	const title = `Today's deals · ${seo.seoStoreName || seo.siteName}`;
	const description = seo.defaultDescription || `Active offers and catalog · ${seo.seoStoreName || seo.siteName}`;
	return {
		title,
		description,
		alternates: { canonical: `${seo.siteUrl}/deals` },
		openGraph: {
			title,
			description,
			url: `${seo.siteUrl}/deals`,
			type: "website",
			images: seo.defaultOgImageUrl ? [seo.defaultOgImageUrl] : undefined,
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: seo.defaultOgImageUrl ? [seo.defaultOgImageUrl] : undefined,
		},
	};
}

export const revalidate = 60;

async function DealsPageContent() {
	const content = await loadDealsContentSafe();

	return (
		<>
			<DealsPageHeader checkoutNotices={content.checkoutNotices} />
			<div className={`${SHOP_CATEGORY_PAGE_CLASS} pb-10 md:pb-20`}>
				<DealsCatalog catalogDeals={content.catalogDeals} productPage={content.productPage} />
			</div>
		</>
	);
}

export default async function DealsPage() {
	return (
		<Suspense fallback={<DealsContentFallback />}>
			<DealsPageContent />
		</Suspense>
	);
}

function DealsContentFallback() {
	return (
		<>
			<DealsPageHeader />
			<div className={`${SHOP_CATEGORY_PAGE_CLASS} pb-10 md:pb-20`}>
				<section className="flex w-full flex-col gap-4 pt-2 pb-6 md:items-center md:pt-4 md:pb-8">
					<Skeleton shape="text" className="mx-auto h-4 w-64 max-w-full md:h-[18px] md:w-96" />
					<div className={classNames(DEAL_BUTTONS_LAYOUT_CLASS)}>
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} shape="block" className="min-h-[5.25rem] w-full rounded-[var(--radius-md)] md:min-h-0 md:h-10 md:w-44 md:rounded-full" />
						))}
					</div>
					<Skeleton shape="text" className="mt-2 h-5 w-40 md:mt-4 md:h-8 md:w-48" />
					<ProductGridSkeleton count={SHOP_CATEGORY_SKELETON_CARDS} className={SHOP_CATEGORY_GRID_CLASS} />
				</section>
			</div>
		</>
	);
}
