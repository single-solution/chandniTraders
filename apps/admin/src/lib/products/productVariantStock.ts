import type { AdminProductSummary } from "@/types/models";

/** How variant quantities roll up for a product shell. */
export type VariantStockRollup = "no_variants" | "all_out_of_stock" | "partial_stock" | "fully_stocked";

export function variantStockRollup(product: AdminProductSummary): VariantStockRollup {
	if (product.variantCount === 0) return "no_variants";
	if (product.inStockCount === 0) return "all_out_of_stock";
	if (product.inStockCount === product.variantCount) return "fully_stocked";
	return "partial_stock";
}
