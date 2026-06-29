import { formatPrice, type AssistantCatalogTableRow, type Product } from "@store/shared";

import { productHref } from "@/lib/catalog/productPaths";
import { isProductInStock } from "@/lib/productSummary";

export function cheapestPriceSummary(product: Product): string {
	let lowestPrice: number | undefined;
	for (const variant of product.variants) {
		if (variant.priceRupees <= 0) {
			continue;
		}
		if (lowestPrice === undefined || variant.priceRupees < lowestPrice) {
			lowestPrice = variant.priceRupees;
		}
	}
	if (lowestPrice === undefined) {
		return "price on request";
	}
	return `from ${formatPrice(lowestPrice)}`;
}

export function productToCatalogTableRow(product: Product): AssistantCatalogTableRow {
	return {
		name: `${product.brandName} ${product.name}`.trim(),
		priceSummary: cheapestPriceSummary(product),
		stockLabel: isProductInStock(product) ? "in stock" : "out of stock",
		linkPath: productHref(product),
	};
}
