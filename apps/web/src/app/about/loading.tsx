import { DesktopProcessFallback, DesktopShopTypesFallback, MobileProcessFallback, MobileShopTypesFallback } from "@/app/_components/home/homePageFallbacks";
import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function AboutLoading() {
	return (
		<SkeletonScreen label="Loading about">
			<div className="app-page space-y-4 pb-10 md:hidden">
				<MobileShopTypesFallback />
				<MobileProcessFallback />
			</div>
			<div className="hidden md:block">
				<DesktopShopTypesFallback />
				<DesktopProcessFallback />
			</div>
		</SkeletonScreen>
	);
}
