/**
 * Stage 4 — apply the approved plan to the live catalog.
 *
 *   node scripts/catalog-rebuild/04-apply.mjs --sample <slug>   # one product, for validation
 *   node scripts/catalog-rebuild/04-apply.mjs                   # full run
 *
 * For every planned product it: registers the real colour/size options on the
 * category attributes (retiring a1/a2/a3), downloads each Woo source image,
 * rebuilds the WebP variant ladder + blur placeholder with sharp, uploads to
 * Vercel Blob, and upserts the product (real variants, real colours, Woo
 * prices) into MongoDB. Products with no Woo price are skipped and reported.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { put } from "@vercel/blob";
import mongoose from "mongoose";
import sharp from "sharp";

import { mongoUri, paths } from "./config.mjs";

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const args = process.argv.slice(2);
const sampleSlug = args.includes("--sample") ? args[args.indexOf("--sample") + 1] : null;
// Default to referencing Woo image URLs directly (allowlisted in next.config).
// Pass --upload-blob to re-host on Vercel Blob once the store is active.
const uploadBlob = args.includes("--upload-blob");

const VARIANT_WIDTHS = { thumb: 160, card: 480, detail: 1080, full: 2400 };
const ATTRIBUTE_LABELS = {
	"motor-type": { ac: "AC", "ac-dc": "AC/DC", inverter: "Inverter" },
	winding: { copper: "99.9% Copper" },
	"body-type": { plastic: "Plastic", metal: "Metal" },
};
const ATTRIBUTE_DISPLAY_LABEL = { "sweep-size": "Sweep Size", "motor-type": "Motor Type", winding: "Winding", "body-type": "Body Type", color: "Color" };

function shortId(byteCount = 6) {
	return randomBytes(byteCount).toString("base64url");
}

async function download(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`download ${url}: ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

async function buildStoredImage(buffer, sourceUrl, keyPrefix, alt) {
	const metadata = await sharp(buffer).metadata();
	const sourceWidth = metadata.width ?? 0;
	const sourceHeight = metadata.height ?? 0;
	if (!sourceWidth || !sourceHeight) throw new Error("Unable to read image dimensions");

	let variants;
	if (uploadBlob) {
		variants = {};
		for (const [name, width] of Object.entries(VARIANT_WIDTHS)) {
			const resize = name === "thumb" ? { width, height: width, fit: "cover", position: "centre", withoutEnlargement: true } : { width, withoutEnlargement: true };
			const out = await sharp(buffer).rotate().resize(resize).webp({ quality: 78, effort: 4 }).toBuffer();
			const key = `${keyPrefix}/${name}-${shortId()}.webp`;
			const result = await put(key, out, { access: "public", contentType: "image/webp", addRandomSuffix: false, token: blobToken });
			variants[name] = result.url;
		}
	} else {
		// Reference the Woo URL directly; the Next optimizer resizes on demand.
		variants = { thumb: sourceUrl, card: sourceUrl, detail: sourceUrl, full: sourceUrl };
	}
	const blurBuffer = await sharp(buffer).rotate().resize(32).webp({ quality: 40 }).toBuffer();
	return {
		variants,
		blurDataURL: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
		width: sourceWidth,
		height: sourceHeight,
		alt: alt.slice(0, 240),
	};
}

/** Rebuild the category attribute docs so every used colour/size/etc. has a real label. */
async function syncAttributes(db, plan) {
	const perCategory = new Map();
	const colorLabels = new Map(plan.colorOptions.map((option) => [option.value, option.label]));
	for (const product of plan.products) {
		const category = product.categorySlug;
		if (!perCategory.has(category)) perCategory.set(category, new Map());
		const attrs = perCategory.get(category);
		for (const variant of product.variants) {
			for (const [slug, value] of Object.entries(variant.attributes)) {
				if (!attrs.has(slug)) attrs.set(slug, new Map());
				const label = slug === "color" ? colorLabels.get(value) ?? value : slug === "sweep-size" ? `${value}"` : ATTRIBUTE_LABELS[slug]?.[value] ?? value;
				attrs.get(slug).set(value, label);
			}
		}
	}
	const attributes = db.collection("attributes");
	let count = 0;
	for (const [category, attrs] of perCategory) {
		for (const [slug, options] of attrs) {
			const optionList = [...options].map(([value, label]) => ({ value, label }));
			await attributes.updateOne(
				{ categorySlug: category, slug },
				{
					$set: { categorySlug: category, slug, label: ATTRIBUTE_DISPLAY_LABEL[slug] ?? slug, options: optionList, isActive: true, updatedAt: new Date() },
					$setOnInsert: { createdAt: new Date(), cardPosition: "title-chips", visibility: { type: "always" } },
				},
				{ upsert: true },
			);
			count += 1;
		}
	}
	return count;
}

async function upsertBrand(db, slug) {
	const names = { royal: "Royal", sk: "SK", taimoor: "Taimoor" };
	await db.collection("brands").updateOne(
		{ slug },
		{ $set: { slug, name: names[slug] ?? slug, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), logoUrl: "" } },
		{ upsert: true },
	);
}

async function buildProductDoc(db, product) {
	const productId = new mongoose.Types.ObjectId();
	const imageCache = new Map();
	const variants = [];
	for (const planVariant of product.variants) {
		const images = [];
		for (const source of planVariant.sourceImages) {
			if (!imageCache.has(source.src)) {
				const hash = createHash("sha1").update(source.src).digest("hex").slice(0, 10);
				const buffer = await download(source.src);
				imageCache.set(source.src, await buildStoredImage(buffer, source.src, `products/${productId}/${hash}`, source.alt || product.name));
			}
			images.push(imageCache.get(source.src));
		}
		variants.push({
			_id: new mongoose.Types.ObjectId(),
			priceRupees: planVariant.priceRupees,
			quantity: planVariant.quantity,
			forceOutOfStock: planVariant.forceOutOfStock,
			attributes: planVariant.attributes,
			attributeDisplay: planVariant.attributeDisplay,
			images,
		});
	}
	// Product gallery = first image of each variant (deduped), capped at 8.
	const gallery = [];
	const seen = new Set();
	for (const variant of variants) {
		const hero = variant.images[0];
		if (hero && !seen.has(hero.variants.full)) {
			seen.add(hero.variants.full);
			gallery.push(hero);
		}
	}
	return {
		productId,
		doc: {
			slug: product.slug,
			name: product.name,
			brandSlug: product.brandSlug,
			categorySlug: product.categorySlug,
			isActive: product.isActive,
			isArchived: product.isArchived,
			isFeatured: product.isFeatured,
			images: gallery.slice(0, 8),
			variants,
			attributeSlugs: product.attributeSlugs,
			attributeOptionPool: {},
			updatedAt: new Date(),
		},
	};
}

async function main() {
	if (uploadBlob && !blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is required with --upload-blob");
	console.log(uploadBlob ? "Image mode: re-host on Vercel Blob" : "Image mode: reference Woo URLs (blob store suspended)");
	const plan = JSON.parse(readFileSync(paths.plan, "utf8"));
	let products = plan.products;
	if (sampleSlug) products = products.filter((row) => row.slug === sampleSlug);

	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
	const db = mongoose.connection.db;

	if (!sampleSlug) {
		const attrCount = await syncAttributes(db, plan);
		console.log(`Synced ${attrCount} category attributes (real colours/sizes; a1/a2/a3 retired).`);
	}

	const report = { written: 0, skipped: [], images: 0 };
	for (const product of products) {
		if (product.variants.some((variant) => variant.priceRupees === null || variant.priceRupees === undefined)) {
			report.skipped.push(`${product.slug} (no Woo price)`);
			continue;
		}
		await upsertBrand(db, product.brandSlug);
		const { doc } = await buildProductDoc(db, product);
		report.images += doc.variants.reduce((sum, variant) => sum + variant.images.length, 0);
		await db.collection("products").updateOne({ slug: product.slug }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
		report.written += 1;
		console.log(`  ✓ ${product.slug} — ${doc.variants.length} variants, ${doc.variants.reduce((sum, variant) => sum + variant.images.length, 0)} imgs`);
	}

	console.log(`\nDone. Written: ${report.written} | Images processed: ${report.images}`);
	if (report.skipped.length > 0) console.log("Skipped:", report.skipped);
	await mongoose.disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
