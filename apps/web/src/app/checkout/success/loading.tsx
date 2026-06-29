import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

export default function CheckoutSuccessLoading() {
	return (
		<SkeletonScreen label="Loading order confirmation">
			<div className={`${STOREFRONT_SHELL_CLASS} flex min-h-[50dvh] flex-col items-center justify-center pb-24 pt-10 text-center md:pb-16`}>
				<Skeleton shape="circle" className="size-14" />
				<Skeleton shape="text" className="mt-5 h-9 w-56 max-w-full" />
				<Skeleton shape="text" className="mt-3 h-4 w-72 max-w-full" />
				<Skeleton shape="pill" className="mt-6 h-11 w-44" />
			</div>
		</SkeletonScreen>
	);
}
