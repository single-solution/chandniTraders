import type { Metadata } from "next";

import AboutPageContent from "@/app/_components/about/AboutPageContent";
import { getStoreSettingsCached } from "@/lib/core/cached";

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
	const { siteName } = await getStoreSettingsCached();
	return {
		title: `About ${siteName}`,
		description: `How we sell, what we stock, and where to find ${siteName}.`,
	};
}

export default function AboutPage() {
	return <AboutPageContent />;
}
