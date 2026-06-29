import { Suspense, type ReactNode } from "react";

import { ShopBannerPersist } from "@/app/_components/shop/ShopBannerPersist";
import { ShopIntroHero } from "@/app/_components/shop/ShopIntroHero";
import { ShopIntroHeroFallback } from "@/components/shared/ShopListingSkeleton";

export default async function ShopCategoryLayout({ children, params }: { children: ReactNode; params: Promise<{ category: string }> }) {
	const { category } = await params;
	return (
		<>
			<ShopBannerPersist>
				<Suspense fallback={<ShopIntroHeroFallback />}>
					<ShopIntroHero categorySlug={category} />
				</Suspense>
			</ShopBannerPersist>
			{children}
		</>
	);
}
