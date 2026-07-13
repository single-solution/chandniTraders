/**
 * Stage 1 — snapshot the WooCommerce catalog.
 *
 *   node scripts/catalog-rebuild/01-fetch-woo.mjs
 *
 * Pulls every published product (and variations for `variable` products)
 * and writes a normalized snapshot to `.data/woo-catalog.json`. All later
 * stages read this file so we hit the live store only once.
 */
import { writeFileSync } from "node:fs";

import { ensureDataDirs, paths, wooFetch, wooFetchAll } from "./config.mjs";

function normalizeImages(rows) {
	if (!Array.isArray(rows)) return [];
	const seen = new Set();
	const images = [];
	for (const row of rows) {
		const src = row?.src?.trim();
		if (!src || seen.has(src)) continue;
		seen.add(src);
		images.push({ src, alt: (row?.alt || row?.name || "").trim() });
	}
	return images;
}

function normalizeVariation(row) {
	return {
		id: row.id,
		price: row.sale_price || row.regular_price || row.price || "",
		regularPrice: row.regular_price || "",
		salePrice: row.sale_price || "",
		stockStatus: row.stock_status || "",
		manageStock: Boolean(row.manage_stock),
		stockQuantity: row.stock_quantity ?? null,
		attributes: (row.attributes || []).map((attribute) => ({
			name: (attribute?.name || "").trim(),
			option: (attribute?.option || "").replace(/&amp;/g, "&").trim(),
		})),
		image: row?.image?.src ? { src: row.image.src, alt: (row.image.alt || row.image.name || "").trim() } : null,
	};
}

async function main() {
	ensureDataDirs();
	console.log("Fetching WooCommerce products…");
	const products = await wooFetchAll((page) => `/products?per_page=100&page=${page}&status=publish`);
	console.log(`Fetched ${products.length} products.`);

	const catalog = [];
	for (const product of products) {
		const isVariable = product.type === "variable";
		let variations = [];
		if (isVariable) {
			const rows = await wooFetchAll((page) => `/products/${product.id}/variations?per_page=100&page=${page}&status=publish`);
			variations = rows.map(normalizeVariation);
			console.log(`  ${product.slug}: ${variations.length} variations`);
		}
		catalog.push({
			id: product.id,
			name: (product.name || "").trim(),
			slug: (product.slug || "").trim(),
			type: product.type,
			featured: Boolean(product.featured),
			categories: (product.categories || []).map((row) => ({ slug: row.slug, name: row.name })),
			brands: (product.brands || []).map((row) => ({ slug: row.slug, name: row.name })),
			price: product.sale_price || product.regular_price || product.price || "",
			regularPrice: product.regular_price || "",
			salePrice: product.sale_price || "",
			stockStatus: product.stock_status || "",
			manageStock: Boolean(product.manage_stock),
			stockQuantity: product.stock_quantity ?? null,
			images: normalizeImages(product.images),
			variations,
		});
	}

	writeFileSync(paths.wooCatalog, JSON.stringify(catalog, null, 2));
	const counts = catalog.reduce((acc, row) => ({ ...acc, [row.type]: (acc[row.type] || 0) + 1 }), {});
	console.log(`Saved ${catalog.length} products to ${paths.wooCatalog}`);
	console.log("Types:", counts);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
