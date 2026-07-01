import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { connectDB } from "../packages/db/src/connection.js";
import { Product } from "../packages/db/src/models/Product.js";
import { processImage } from "../apps/admin/src/lib/uploads/processImage.ts";
import { resolveStorageProvider } from "../packages/shared/src/server.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(scriptDir, "../.env.local");

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

const wooBase = (process.env.WOO_BASE_URL ?? "https://chandnitraders.pk").replace(/\/$/, "");
const wooKey = process.env.WOO_CONSUMER_KEY;
const wooSecret = process.env.WOO_CONSUMER_SECRET;

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
		console.log(`Fetching WooCommerce products page ${page}...`);
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

async function downloadImage(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

function slugify(text) {
	return text.toString().toLowerCase()
		.replace(/\s+/g, '-')           // Replace spaces with -
		.replace(/[^\w\-]+/g, '')       // Remove all non-word chars
		.replace(/\-\-+/g, '-')         // Replace multiple - with single -
		.replace(/^-+/, '')             // Trim - from start of text
		.replace(/-+$/, '');            // Trim - from end of text
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
		attributes[slugify(name)] = slugify(option);
	}
	return attributes;
}

function matchVariant(dbVariants, wooVariation, index, totalWoo, totalDb) {
	const wooAttrs = parseWooVariationAttributes(wooVariation);
	
	let match = dbVariants.find(v => {
		const dbAttrs = v.attributes || {};
		for (const [key, value] of Object.entries(wooAttrs)) {
			const wooVal = value.replace('-amp-', '-');
			const dbVal = dbAttrs[key] || dbAttrs['color'];
			if (!dbVal || (!dbVal.includes(wooVal) && !wooVal.includes(dbVal))) {
				return false;
			}
		}
		return true;
	});

	if (match) return match;

	if (Object.keys(wooAttrs).length === 1) {
		const wooVal = Object.values(wooAttrs)[0].replace('-amp-', '-');
		match = dbVariants.find(v => {
			const dbAttrs = v.attributes || {};
			return Object.values(dbAttrs).some(dbVal => dbVal.includes(wooVal) || wooVal.includes(dbVal));
		});
	}

	if (match) return match;

	// Fallback to index-based matching if lengths are identical
	if (totalWoo === totalDb && index < dbVariants.length) {
		return dbVariants[index];
	}

	return null;
}

async function main() {
	await connectDB();
	const storage = await resolveStorageProvider();

	const wooProducts = await fetchAllWooProducts();
	console.log(`Found ${wooProducts.length} WooCommerce products.`);

	for (const wooProduct of wooProducts) {
		const dbProduct = await Product.findOne({ slug: wooProduct.slug });
		if (!dbProduct) {
			console.log(`Product ${wooProduct.slug} not found in DB, skipping.`);
			continue;
		}

		console.log(`Processing product: ${dbProduct.slug}`);

		let variations = [];
		if (wooProduct.type === "variable") {
			variations = await fetchVariations(wooProduct.id);
		} else {
			variations = [wooProduct]; // Treat simple product as a single variation
		}

		let updated = false;
		const parentImages = wooProduct.images || [];

		let index = 0;
		for (const variation of variations) {
			let dbVariant;
			if (wooProduct.type === "variable") {
				dbVariant = matchVariant(dbProduct.variants, variation, index, variations.length, dbProduct.variants.length);
			} else {
				dbVariant = dbProduct.variants[0];
			}

			if (!dbVariant) {
				console.log(`  Could not find matching DB variant for WooCommerce variation ${variation.id}`);
				index++;
				continue;
			}

			// Check if already processed (has variants.full and not a woo url)
			let needsUpdate = false;
			if (!dbVariant.images || dbVariant.images.length === 0) {
				needsUpdate = true;
			} else {
				for (const img of dbVariant.images) {
					if (!img.variants?.full || img.variants.full.includes("chandnitraders.pk/wp-content")) {
						needsUpdate = true;
						break;
					}
				}
			}

			if (!needsUpdate) {
				console.log(`  Variant already has processed images, skipping.`);
				continue;
			}

			let imageSources = [];
			
			if (wooProduct.type === "variable") {
				const src = variation?.image?.src ?? variation?.image?.url;
				if (src) {
					imageSources.push({
						src,
						alt: variation?.image?.alt || variation?.image?.name || wooProduct.name
					});
				} else {
					imageSources = parentImages.map(img => ({
						src: img.src,
						alt: img.alt || img.name || wooProduct.name
					}));
				}
			} else {
				imageSources = parentImages.map(img => ({
					src: img.src,
					alt: img.alt || img.name || wooProduct.name
				}));
			}

			if (imageSources.length === 0) continue;

			const newImages = [];
			for (const imgSource of imageSources) {
				if (!imgSource.src) continue;
				console.log(`  Downloading image for variant: ${imgSource.src}`);
				try {
					const buffer = await downloadImage(imgSource.src);
					const storedImage = await processImage({
						buffer,
						keyPrefix: `products/${dbProduct._id}/variants/${dbVariant._id}`,
						alt: imgSource.alt.slice(0, 240),
						storage
					});
					newImages.push(storedImage);
					console.log(`  Successfully processed and uploaded image.`);
				} catch (err) {
					console.error(`  Failed to process image for variant:`, err.message);
				}
			}

			if (newImages.length > 0) {
				dbVariant.images = newImages;
				updated = true;
			}
			index++;
		}

		if (updated) {
			await dbProduct.save();
			console.log(`Saved updated product ${dbProduct.slug} to DB.`);
		}
	}
	
	console.log("Done.");
	process.exit(0);
}

main().catch(console.error);
