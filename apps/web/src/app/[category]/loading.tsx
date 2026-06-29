import { ShopCategoryPageLoading } from "@/components/shared/ShopListingSkeleton";

/** Listing shell only — banner lives in the category layout Suspense fallback. */
export default function ShopCategoryLoading() {
	return <ShopCategoryPageLoading />;
}
