import { HomeBanner } from "@/app/_components/home/HomeBanner";

interface ShopIntroHeroProps {
	categorySlug?: string;
}

/** Compact storefront intro — shared by legacy call sites; uses the new image banner. */
export async function ShopIntroHero({ categorySlug }: ShopIntroHeroProps = {}) {
	return <HomeBanner compact categorySlug={categorySlug} />;
}
