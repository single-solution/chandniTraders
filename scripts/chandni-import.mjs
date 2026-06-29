/**
 * Chandni Traders — seed taxonomy + import WooCommerce catalog.
 *
 *   npx tsx scripts/chandni-import.mjs --dry-run
 *   npx tsx scripts/chandni-import.mjs
 *   npx tsx scripts/chandni-import.mjs --fix-variant-ids
 *
 * Requires in `.env.local`:
 *   MONGODB_URI
 *   WOO_BASE_URL=https://chandnitraders.pk
 *   WOO_CONSUMER_KEY
 *   WOO_CONSUMER_SECRET
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { slugify } from "../packages/shared/src/slug.ts";
import { CATALOG_BRAND_DEFINITIONS, resolveProductBrandSlug } from "../packages/shared/src/catalogBrands.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(scriptDir, "../.env.local");
const isDryRun = process.argv.includes("--dry-run");
const shouldPurge = process.argv.includes("--purge-catalog");
const seedOnly = process.argv.includes("--seed-only");
const fixVariantIdsOnly = process.argv.includes("--fix-variant-ids");

function loadEnvFile(path) {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const index = trimmed.indexOf("=");
		const key = trimmed.slice(0, index).trim();
		const value = trimmed.slice(index + 1).trim();
		if (!process.env[key]) process.env[key] = value;
	}
}

loadEnvFile(envLocalPath);

const uri = process.env.MONGODB_URI;
const wooBase = (process.env.WOO_BASE_URL ?? "https://chandnitraders.pk").replace(/\/$/, "");
const wooKey = process.env.WOO_CONSUMER_KEY;
const wooSecret = process.env.WOO_CONSUMER_SECRET;

if (!uri) {
	console.error("MONGODB_URI is not set.");
	process.exit(1);
}
if (!seedOnly && !fixVariantIdsOnly && (!wooKey || !wooSecret)) {
	console.error("WOO_CONSUMER_KEY and WOO_CONSUMER_SECRET are required (unless --seed-only or --fix-variant-ids).");
	process.exit(1);
}

const PLACEHOLDER_BLUR =
	"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

const CATEGORY_SEED = [
	// Nav grouping only — no products; keep inactive so `/` lands on a stocked shop.
	{ slug: "fans", label: "Fans", description: "Ceiling, bracket, exhaust, and pedestal fans.", sortOrder: 10, isActive: false },
	{ slug: "ceiling-fans", label: "Ceiling Fans", description: "220V, inverter, AC/DC, and eco ceiling fans.", sortOrder: 20 },
	{ slug: "bracket-fans", label: "Bracket Fans", description: "Wall-mounted bracket and louver fans.", sortOrder: 30 },
	{ slug: "exhaust-fans", label: "Exhaust Fans", description: "Metal and plastic exhaust ventilation fans.", sortOrder: 40 },
	{ slug: "pedestal-fans", label: "Pedestal Fans", description: "Pedestal and industrial floor fans.", sortOrder: 50 },
	{ slug: "room-coolers", label: "Room Coolers", description: "Room coolers and evaporative cooling units.", sortOrder: 60 },
];

const BRAND_SLUGS = new Set(CATALOG_BRAND_DEFINITIONS.map((brand) => brand.slug));

const WOO_CATEGORY_MAP = {
	"bracket-fans": "bracket-fans",
	"ceiling-fans": "ceiling-fans",
	"220v-fans": "ceiling-fans",
	"30w-fans": "ceiling-fans",
	"ac-dc-fans": "ceiling-fans",
	"inverter-fans": "ceiling-fans",
	fans: "ceiling-fans",
	"exhaust-fans": "exhaust-fans",
	"pedestal-fans": "pedestal-fans",
	uncategorized: null,
};

function mapWooCategory(categories) {
	if (!Array.isArray(categories) || categories.length === 0) return null;
	const slugs = categories.map((row) => row.slug).filter(Boolean);
	for (const slug of slugs) {
		if (slug.includes("cooler")) return "room-coolers";
		const mapped = WOO_CATEGORY_MAP[slug];
		if (mapped) return mapped;
	}
	return null;
}

function parsePrice(value) {
	const amount = Number.parseFloat(String(value ?? "0"));
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return Math.round(amount);
}

function wooRowIsInStock(row) {
	const status = String(row?.stock_status ?? "").toLowerCase();
	return status === "instock" || status === "onbackorder";
}

function parseWooQuantity(row) {
	if (row?.manage_stock) {
		return Math.max(0, Number(row.stock_quantity ?? 0));
	}
	return wooRowIsInStock(row) ? 25 : 0;
}

function parseWooVariationAttributes(row) {
	const attributes = {};
	if (!Array.isArray(row?.attributes)) {
		return attributes;
	}
	for (const attribute of row.attributes) {
		const name = attribute?.name?.trim();
		const option = attribute?.option?.trim();
		if (!name || !option) {
			continue;
		}
		attributes[slugify(name, 48)] = slugify(option, 64);
	}
	return attributes;
}

function collectAttributeSlugs(variants) {
	const slugs = new Set();
	for (const variant of variants) {
		for (const slug of Object.keys(variant.attributes ?? {})) {
			if (slug) {
				slugs.add(slug);
			}
		}
	}
	return [...slugs];
}

/** Mongoose subdocument ids are only auto-assigned through the ODM — raw updates must set these explicitly. */
function ensureVariantIds(variants) {
	return variants.map((variant) => ({
		...variant,
		_id: variant._id ?? new mongoose.Types.ObjectId(),
	}));
}

function storedImageFromUrl(url, alt) {
	const src = url?.trim();
	if (!src) return null;
	return {
		variants: { thumb: src, card: src, detail: src, full: src },
		blurDataURL: PLACEHOLDER_BLUR,
		width: 800,
		height: 800,
		alt: alt.slice(0, 240),
	};
}

function imagesFromWooGallery(rows, alt) {
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row) => storedImageFromUrl(row?.src, row?.alt || alt))
		.filter(Boolean)
		.slice(0, 8);
}

function imagesFromWooVariation(row, alt) {
	const src = row?.image?.src ?? row?.image?.url;
	if (!src) return [];
	const image = storedImageFromUrl(src, row?.image?.alt || row?.image?.name || alt);
	return image ? [image] : [];
}

async function wooFetch(path) {
	const url = new URL(`${wooBase}/wp-json/wc/v3${path}`);
	url.searchParams.set("consumer_key", wooKey);
	url.searchParams.set("consumer_secret", wooSecret);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`WooCommerce ${path} failed: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function fetchAllWooProducts() {
	const rows = [];
	let page = 1;
	while (true) {
		const batch = await wooFetch(`/products?per_page=100&page=${page}&status=publish`);
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return rows;
}

async function fetchVariations(productId) {
	const rows = [];
	let page = 1;
	while (true) {
		const batch = await wooFetch(`/products/${productId}/variations?per_page=100&page=${page}&status=publish`);
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return rows;
}

function buildVariantsFromWoo(product, variations, productName) {
	const parentImages = imagesFromWooGallery(product.images, productName);

	if (product.type === "variable" && variations.length > 0) {
		return variations
			.map((row) => {
				const price = parsePrice(row.sale_price) ?? parsePrice(row.regular_price) ?? parsePrice(row.price);
				if (price === null) return null;
				const quantity = parseWooQuantity(row);
				const variantImages = imagesFromWooVariation(row, productName);
				return {
					_id: new mongoose.Types.ObjectId(),
					priceRupees: price,
					quantity,
					forceOutOfStock: !wooRowIsInStock(row),
					attributes: parseWooVariationAttributes(row),
					images: variantImages.length > 0 ? variantImages : parentImages,
				};
			})
			.filter(Boolean);
	}

	const price = parsePrice(product.sale_price) ?? parsePrice(product.regular_price) ?? parsePrice(product.price);
	if (price === null) return [];
	const quantity = parseWooQuantity(product);
	return [
		{
			_id: new mongoose.Types.ObjectId(),
			priceRupees: price,
			quantity,
			forceOutOfStock: !wooRowIsInStock(product),
			attributes: {},
			images: parentImages,
		},
	];
}

async function fetchWooBrandLogos() {
	try {
		const rows = await wooFetch("/products/brands?per_page=100");
		if (!Array.isArray(rows)) {
			return new Map();
		}
		return new Map(
			rows
				.filter((row) => row?.slug && row?.image?.src)
				.map((row) => [String(row.slug).toLowerCase(), String(row.image.src)]),
		);
	} catch {
		return new Map();
	}
}

async function seedBrands(db, categorySlugs) {
	const brands = db.collection("brands");
	const wooLogos = await fetchWooBrandLogos();
	let count = 0;

	for (const brand of CATALOG_BRAND_DEFINITIONS) {
		const payload = {
			slug: brand.slug,
			name: brand.name,
			logoUrl: wooLogos.get(brand.slug) ?? brand.logoUrl,
			categorySlugs,
			isActive: true,
			updatedAt: new Date(),
		};
		if (isDryRun) {
			count += 1;
			continue;
		}
		await brands.updateOne(
			{ slug: brand.slug },
			{
				$set: payload,
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
		count += 1;
	}

	return count;
}

async function syncBrandLogos(db) {
	if (isDryRun) {
		return 0;
	}
	const brands = db.collection("brands");
	const wooLogos = await fetchWooBrandLogos();
	let updated = 0;

	for (const brand of CATALOG_BRAND_DEFINITIONS) {
		const logoUrl = wooLogos.get(brand.slug) ?? brand.logoUrl;
		if (!logoUrl) {
			continue;
		}
		await brands.updateOne({ slug: brand.slug }, { $set: { logoUrl, updatedAt: new Date() } });
		updated += 1;
	}
	return updated;
}

/** Fold legacy inferred slugs into the three Woo manufacturer brands. */
async function remapLegacyProductBrands(db) {
	if (isDryRun) {
		return 0;
	}
	const products = db.collection("products");
	const remap = {
		mega: "royal",
		circomatic: "royal",
		diamond: "royal",
		sapphire: "royal",
		ovate: "royal",
		penta: "taimoor",
	};
	let total = 0;
	for (const [fromSlug, toSlug] of Object.entries(remap)) {
		const result = await products.updateMany({ brandSlug: fromSlug }, { $set: { brandSlug: toSlug, updatedAt: new Date() } });
		total += result.modifiedCount ?? 0;
	}
	return total;
}

async function cleanupInvalidBrands(db) {
	if (isDryRun) {
		return 0;
	}
	const brands = db.collection("brands");
	const result = await brands.deleteMany({
		slug: { $nin: [...BRAND_SLUGS] },
	});
	return result.deletedCount ?? 0;
}

async function seedTaxonomy(db) {
	const report = { categories: 0, brands: 0 };
	const categories = db.collection("categories");

	for (const row of CATEGORY_SEED) {
		const payload = {
			slug: row.slug,
			label: row.label,
			description: row.description,
			icon: "fan",
			sortOrder: row.sortOrder,
			isActive: row.isActive ?? true,
			updatedAt: new Date(),
		};
		if (isDryRun) {
			report.categories += 1;
			continue;
		}
		await categories.updateOne({ slug: row.slug }, { $set: payload, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
		report.categories += 1;
	}

	const activeCategorySlugs = CATEGORY_SEED.filter((row) => row.isActive !== false).map((row) => row.slug);
	report.brands = await seedBrands(db, activeCategorySlugs);

	return report;
}

async function importProducts(db) {
	const products = db.collection("products");
	const brands = db.collection("brands");
	const wooProducts = await fetchAllWooProducts();
	const report = { imported: 0, updated: 0, skipped: 0, skippedReasons: [] };

	for (const wooProduct of wooProducts) {
		const name = wooProduct.name?.trim();
		const slug = wooProduct.slug?.trim();
		if (!name || !slug) {
			report.skipped += 1;
			report.skippedReasons.push(`#${wooProduct.id}: missing name/slug`);
			continue;
		}

		const categorySlug =
			mapWooCategory(wooProduct.categories) ?? (/cooler/i.test(name) ? "room-coolers" : null);
		if (!categorySlug) {
			report.skipped += 1;
			report.skippedReasons.push(`${slug}: unmapped category`);
			continue;
		}

		const brand = resolveProductBrandSlug(name, wooProduct.brands);
		const brandSlug = brand.slug;
		if (!isDryRun) {
			await brands.updateOne(
				{ slug: brandSlug },
				{
					$set: {
						slug: brandSlug,
						name: brand.name,
						isActive: true,
						updatedAt: new Date(),
					},
					$addToSet: { categorySlugs: categorySlug },
					$setOnInsert: { createdAt: new Date(), logoUrl: "" },
				},
				{ upsert: true },
			);
		}

		const variations = wooProduct.type === "variable" ? await fetchVariations(wooProduct.id) : [];
		const variants = buildVariantsFromWoo(wooProduct, variations, name);
		if (variants.length === 0) {
			report.skipped += 1;
			report.skippedReasons.push(`${slug}: no price/stock`);
			continue;
		}

		const images = imagesFromWooGallery(wooProduct.images, name);

		const payload = {
			slug,
			name,
			brandSlug,
			categorySlug,
			isActive: true,
			isArchived: false,
			isFeatured: Boolean(wooProduct.featured),
			images,
			variants: ensureVariantIds(variants),
			attributeSlugs: collectAttributeSlugs(variants),
			attributeOptionPool: {},
			updatedAt: new Date(),
		};

		if (isDryRun) {
			report.imported += 1;
			continue;
		}

		const existing = await products.findOne({ slug }, { projection: { _id: 1 } });
		await products.updateOne({ slug }, { $set: payload, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
		if (existing) report.updated += 1;
		else report.imported += 1;
	}

	return report;
}

async function backfillVariantIds(db) {
	const filter = { variants: { $elemMatch: { _id: { $exists: false } } } };
	const pending = await db.collection("products").countDocuments(filter);
	if (pending === 0) {
		return { updated: 0, pending: 0 };
	}
	if (isDryRun) {
		return { updated: 0, pending };
	}

	let updated = 0;
	const cursor = db.collection("products").find(filter);
	for await (const product of cursor) {
		await db.collection("products").updateOne(
			{ _id: product._id },
			{
				$set: {
					variants: ensureVariantIds(product.variants ?? []),
					updatedAt: new Date(),
				},
			},
		);
		updated += 1;
	}
	return { updated, pending };
}

async function main() {
	await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
	const db = mongoose.connection.db;

	console.log(isDryRun ? "[dry-run]" : "[live]", "Chandni import starting…");

	if (fixVariantIdsOnly) {
		const backfill = await backfillVariantIds(db);
		console.log("Variant id backfill:", backfill);
		await mongoose.disconnect();
		console.log("Done.");
		return;
	}

	if (shouldPurge && !isDryRun) {
		await db.collection("products").deleteMany({});
		await db.collection("brands").deleteMany({});
		await db.collection("grades").deleteMany({});
		await db.collection("categories").deleteMany({});
		console.log("Purged existing catalog collections.");
	}

	const seedReport = await seedTaxonomy(db);
	console.log("Taxonomy seed:", seedReport);

	if (!seedOnly) {
		const importReport = await importProducts(db);
		const remapped = await remapLegacyProductBrands(db);
		const logosUpdated = await syncBrandLogos(db);
		const removedBrands = await cleanupInvalidBrands(db);
		console.log("Product import:", {
			imported: importReport.imported,
			updated: importReport.updated,
			skipped: importReport.skipped,
		});
		console.log("Legacy brand remaps:", remapped, "| Brand logos updated:", logosUpdated, "| Invalid brands removed:", removedBrands);
		if (importReport.skippedReasons.length > 0) {
			console.log("Skipped sample:", importReport.skippedReasons.slice(0, 15));
		}
	}

	const backfill = await backfillVariantIds(db);
	console.log("Variant id backfill:", backfill);

	await mongoose.disconnect();
	console.log("Done.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
