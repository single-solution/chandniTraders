import { Suspense } from "react";

import { buildProcessFlows } from "@/app/_components/home/homeProcessFlows";
import { DesktopProcessSection, DesktopShopTypesSection, DesktopVisitStore } from "@/app/_components/home/homePageDesktopSections";
import {
	DesktopProcessFallback,
	DesktopShopTypesFallback,
	DesktopVisitStoreFallback,
	MobileProcessFallback,
	MobileShopTypesFallback,
	MobileVisitStoreFallback,
} from "@/app/_components/home/homePageFallbacks";
import { MobileProcessSection, MobileShopTypesSection, MobileVisitStoreSection } from "@/app/_components/home/homePageMobileSections";
import { getStoreSettingsCached } from "@/lib/core/cached";
import { loadHomeCategoryTiles } from "@/lib/core/pageData";

export default function AboutPageContent() {
	return (
		<>
			<div className="app-page pb-10 md:hidden space-y-4">
				<Suspense fallback={<MobileShopTypesFallback />}>
					<MobileShopTypesData />
				</Suspense>
				<Suspense fallback={<MobileProcessFallback />}>
					<MobileProcessData />
				</Suspense>
				<Suspense fallback={<MobileVisitStoreFallback />}>
					<MobileVisitStoreData />
				</Suspense>
			</div>

			<div className="hidden md:block">
				<Suspense fallback={<DesktopShopTypesFallback />}>
					<DesktopShopTypesData />
				</Suspense>
				<Suspense fallback={<DesktopProcessFallback />}>
					<DesktopProcessData />
				</Suspense>
				<Suspense fallback={<DesktopVisitStoreFallback />}>
					<DesktopVisitStoreData />
				</Suspense>
			</div>
		</>
	);
}

async function MobileShopTypesData() {
	const categories = await loadHomeCategoryTiles();
	return <MobileShopTypesSection categories={categories} />;
}

async function MobileProcessData() {
	const settings = await getStoreSettingsCached();
	return <MobileProcessSection flows={buildProcessFlows(settings)} />;
}

async function MobileVisitStoreData() {
	const settings = await getStoreSettingsCached();
	return <MobileVisitStoreSection settings={settings} />;
}

async function DesktopShopTypesData() {
	const categories = await loadHomeCategoryTiles();
	return <DesktopShopTypesSection categories={categories} />;
}

async function DesktopProcessData() {
	const settings = await getStoreSettingsCached();
	return <DesktopProcessSection flows={buildProcessFlows(settings)} />;
}

async function DesktopVisitStoreData() {
	const settings = await getStoreSettingsCached();
	return <DesktopVisitStore settings={settings} />;
}
