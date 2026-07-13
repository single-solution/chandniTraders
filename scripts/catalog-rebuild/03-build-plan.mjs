/**
 * Stage 3 — build the proposed catalog and diff it against the live DB.
 *
 *   node scripts/catalog-rebuild/03-build-plan.mjs
 *
 * Combines the Woo snapshot, montage index, and vision color decisions into
 * a proposed product list (one variant per real color, Woo prices, real
 * color names). Diffs it against the current MongoDB catalog and writes a
 * machine plan (`.data/plan.json`) plus a human report (`dry-run-report.md`).
 * Writes nothing to the database.
 */
import { readFileSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

import { mongoUri, paths } from "./config.mjs";
import { deriveAttributes, inStock, mapCategory, parsePrice, resolveBrand, slugify } from "./lib.mjs";

function variationById(product) {
	const map = new Map();
	for (const variation of product.variations || []) map.set(variation.id, variation);
	return map;
}

function priceForColor(product, tiles, color, variationMap) {
	if (product.type === "variable") {
		for (const index of color.imageIndexes) {
			const tile = tiles[index];
			if (tile?.variationId && variationMap.has(tile.variationId)) {
				const variation = variationMap.get(tile.variationId);
				const price = parsePrice(variation.price);
				if (price !== null) return { price, stockStatus: variation.stockStatus };
			}
		}
	}
	return { price: parsePrice(product.price), stockStatus: product.stockStatus };
}

/** True when a variable product's variations differ by Size rather than colour. */
function isSizeVariation(product) {
	if (product.type !== "variable" || product.variations.length === 0) return false;
	return product.variations.every((variation) => variation.attributes.some((attribute) => /size/i.test(attribute.name)));
}

function sizeValue(variation) {
	for (const attribute of variation.attributes) {
		if (/size/i.test(attribute.name)) {
			const digits = String(attribute.option).match(/\d+/);
			if (digits) return digits[0];
		}
	}
	return null;
}

function buildProposed(product, tiles, decision, variationMap) {
	const name = product.name;
	const categorySlug = mapCategory(product.categories, name);
	const brand = resolveBrand(name, product.brands);
	const baseAttributes = deriveAttributes(name, categorySlug);

	// Size-variation products: one variant per Woo size, single real colour, shared images.
	if (isSizeVariation(product)) {
		const color = decision.colors[0];
		const colorSlug = slugify(color.name);
		const sources = color.imageIndexes.map((index) => tiles[index]).filter(Boolean).map((tile) => ({ src: tile.src, alt: tile.alt }));
		const variants = product.variations.map((variation) => {
			const size = sizeValue(variation);
			const attributes = { ...baseAttributes, color: colorSlug };
			if (size) attributes["sweep-size"] = size;
			return {
				colorSlug,
				colorLabel: `${color.name}${size ? ` — ${size}"` : ""}`,
				priceRupees: parsePrice(variation.price),
				quantity: inStock(variation.stockStatus) ? 25 : 0,
				forceOutOfStock: !inStock(variation.stockStatus),
				attributes,
				attributeDisplay: { color: color.name },
				sourceImages: sources,
			};
		});
		const attributeSlugs = [...new Set(variants.flatMap((variant) => Object.keys(variant.attributes)))];
		return {
			slug: product.slug,
			name,
			brandSlug: brand.slug,
			categorySlug,
			isActive: true,
			isArchived: false,
			isFeatured: Boolean(product.featured),
			attributeSlugs,
			colorOptions: [{ value: colorSlug, label: color.name }],
			wooType: product.type,
			variants,
			note: decision.note ?? null,
		};
	}

	const colorOptions = [];
	const variants = decision.colors.map((color) => {
		const colorSlug = slugify(color.name);
		colorOptions.push({ value: colorSlug, label: color.name });
		const { price, stockStatus } = priceForColor(product, tiles, color, variationMap);
		const sources = color.imageIndexes.map((index) => tiles[index]).filter(Boolean).map((tile) => ({ src: tile.src, alt: tile.alt }));
		return {
			colorSlug,
			colorLabel: color.name,
			priceRupees: price,
			quantity: inStock(stockStatus) ? 25 : 0,
			forceOutOfStock: !inStock(stockStatus),
			attributes: { ...baseAttributes, color: colorSlug },
			attributeDisplay: { color: color.name },
			sourceImages: sources,
		};
	});

	const attributeSlugs = [...new Set(variants.flatMap((variant) => Object.keys(variant.attributes)))];
	return {
		slug: product.slug,
		name,
		brandSlug: brand.slug,
		categorySlug,
		isActive: true,
		isArchived: false,
		isFeatured: Boolean(product.featured),
		attributeSlugs,
		colorOptions,
		wooType: product.type,
		variants,
		note: decision.note ?? null,
	};
}

function priceRange(variants) {
	const prices = variants.map((variant) => variant.priceRupees).filter((price) => price !== null && price !== undefined);
	if (prices.length === 0) return "—";
	const min = Math.min(...prices);
	const max = Math.max(...prices);
	return min === max ? `Rs ${min.toLocaleString()}` : `Rs ${min.toLocaleString()}–${max.toLocaleString()}`;
}

function colorList(variants, useLabel) {
	return variants.map((variant) => (useLabel ? variant.colorLabel : variant.color) ?? variant.colorSlug).join(", ");
}

const OPAQUE = /^a\d+$/i;

async function main() {
	const catalog = JSON.parse(readFileSync(paths.wooCatalog, "utf8"));
	const montageIndex = JSON.parse(readFileSync(paths.montageIndex, "utf8"));
	const decisions = JSON.parse(readFileSync(paths.colorDecisions, "utf8"));

	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
	const products = mongoose.connection.db.collection("products");
	const currentBySlug = new Map();
	for (const doc of await products.find({}, { projection: { slug: 1, variants: 1, name: 1 } }).toArray()) {
		currentBySlug.set(doc.slug, doc);
	}

	const plan = [];
	const skipped = [];
	const allColorOptions = new Map();
	for (const product of catalog) {
		const decision = decisions[product.slug];
		const tiles = montageIndex[product.slug]?.tiles ?? [];
		if (!decision || decision.colors.length === 0) {
			skipped.push(`${product.slug}: no color decision`);
			continue;
		}
		const proposed = buildProposed(product, tiles, decision, variationById(product));
		if (proposed.variants.some((variant) => variant.priceRupees === null)) {
			skipped.push(`${product.slug}: missing Woo price`);
		}
		for (const option of proposed.colorOptions) allColorOptions.set(option.value, option.label);
		plan.push(proposed);
	}

	writeFileSync(paths.plan, JSON.stringify({ generatedAt: new Date().toISOString(), products: plan, colorOptions: [...allColorOptions].map(([value, label]) => ({ value, label })) }, null, 2));

	// ---- Human report ----
	const lines = [];
	lines.push("# Catalog Rebuild — Dry-Run Report");
	lines.push("");
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push("");
	const newProducts = plan.filter((row) => !currentBySlug.has(row.slug));
	const oldVariantTotal = [...currentBySlug.values()].reduce((sum, doc) => sum + (doc.variants?.length ?? 0), 0);
	const newVariantTotal = plan.reduce((sum, row) => sum + row.variants.length, 0);
	let opaqueRemoved = 0;
	for (const doc of currentBySlug.values()) {
		for (const variant of doc.variants ?? []) {
			if (Object.values(variant.attributes ?? {}).some((value) => OPAQUE.test(String(value)))) opaqueRemoved += 1;
		}
	}
	lines.push("## Summary");
	lines.push("");
	lines.push(`- Published Woo products planned: **${plan.length}**`);
	lines.push(`- New to database (not currently present): **${newProducts.length}**`);
	lines.push(`- Current DB variants: **${oldVariantTotal}** → Proposed variants: **${newVariantTotal}**`);
	lines.push(`- Variants currently using opaque a1/a2/a3 codes (all removed): **${opaqueRemoved}**`);
	lines.push(`- Distinct real color options after rebuild: **${allColorOptions.size}**`);
	if (skipped.length > 0) lines.push(`- Skipped/attention: **${skipped.length}** (${skipped.join("; ")})`);
	lines.push("");
	lines.push(`Color options registered: ${[...allColorOptions.values()].sort().join(", ")}`);
	lines.push("");
	lines.push("## Per-product changes");
	lines.push("");
	lines.push("| Product | Cat | Brand | Old variants | New variants (colors) | Price | Flags |");
	lines.push("|---|---|---|---|---|---|---|");
	for (const row of plan.sort((a, b) => a.slug.localeCompare(b.slug))) {
		const current = currentBySlug.get(row.slug);
		const oldCount = current?.variants?.length ?? 0;
		const oldColors = (current?.variants ?? []).map((variant) => variant.attributes?.color).filter(Boolean);
		const hadOpaque = oldColors.some((value) => OPAQUE.test(String(value)));
		const flags = [];
		if (!current) flags.push("NEW");
		if (hadOpaque) flags.push("fixed a1/a2");
		if (oldCount > row.variants.length) flags.push(`−${oldCount - row.variants.length} phantom`);
		if (oldCount < row.variants.length && current) flags.push(`+${row.variants.length - oldCount}`);
		if (row.note) flags.push("note");
		const newColors = row.variants.map((variant) => variant.colorLabel).join(", ");
		lines.push(`| ${row.slug} | ${row.categorySlug} | ${row.brandSlug} | ${oldCount} | ${row.variants.length} (${newColors}) | ${priceRange(row.variants)} | ${flags.join(", ")} |`);
	}
	lines.push("");
	const noted = plan.filter((row) => row.note);
	if (noted.length > 0) {
		lines.push("## Notes / judgment calls");
		lines.push("");
		for (const row of noted) lines.push(`- **${row.slug}**: ${row.note}`);
		lines.push("");
	}
	writeFileSync(paths.report, lines.join("\n"));

	console.log(`Plan: ${plan.length} products, ${newVariantTotal} variants, ${allColorOptions.size} colors.`);
	console.log(`Report: ${paths.report}`);
	if (skipped.length > 0) console.log("Skipped:", skipped);
	await mongoose.disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
