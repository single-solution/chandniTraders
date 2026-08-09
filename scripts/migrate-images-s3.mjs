import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

import mongoose from "mongoose";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

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

loadEnvFile(resolve(repoRoot, ".env.local"));

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required");

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_S3_REGION || "auto";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.AWS_S3_ENDPOINT;
const publicUrlBase = process.env.AWS_S3_PUBLIC_URL_BASE?.replace(/\/$/, "");

if (!bucket || !accessKeyId || !secretAccessKey) {
	throw new Error("S3 credentials (bucket, accessKeyId, secretAccessKey) are required in .env.local");
}

const s3Client = new S3Client({
	region,
	credentials: { accessKeyId, secretAccessKey },
	...(endpoint ? { endpoint, forcePathStyle: true } : {}),
});

const args = process.argv.slice(2);
const sampleSlug = args.includes("--sample") ? args[args.indexOf("--sample") + 1] : null;

const VARIANT_WIDTHS = { thumb: 160, card: 480, detail: 1080, full: 2400 };

function shortId(byteCount = 6) {
	return randomBytes(byteCount).toString("base64url");
}

async function downloadSecurelyViaIP(urlPath) {
	// urlPath is like /wp-content/uploads/...
	return new Promise((resolvePromise, rejectPromise) => {
		const req = https.request(
			{
				hostname: "185.151.30.221",
				port: 443,
				path: urlPath,
				method: "GET",
				headers: {
					Host: "chandnitraders.pk",
				},
				rejectUnauthorized: false, // IP won't match the SSL cert for chandnitraders.pk
			},
			(res) => {
				if (res.statusCode !== 200) {
					rejectPromise(new Error(`Failed to download ${urlPath}: HTTP ${res.statusCode}`));
					return;
				}
				const chunks = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => resolvePromise(Buffer.concat(chunks)));
			}
		);
		req.on("error", (err) => rejectPromise(err));
		req.end();
	});
}

function publicUrlForS3Key(key) {
	if (publicUrlBase) {
		return `${publicUrlBase}/${key}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function uploadToS3(key, buffer, contentType) {
	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		})
	);
	return publicUrlForS3Key(key);
}

async function processImage(buffer, keyPrefix, alt) {
	const metadata = await sharp(buffer).metadata();
	const sourceWidth = metadata.width ?? 0;
	const sourceHeight = metadata.height ?? 0;
	if (!sourceWidth || !sourceHeight) throw new Error("Unable to read image dimensions");

	const variants = {};
	for (const [name, width] of Object.entries(VARIANT_WIDTHS)) {
		const resize =
			name === "thumb"
				? { width, height: width, fit: "cover", position: "centre", withoutEnlargement: true }
				: { width, withoutEnlargement: true };
		const out = await sharp(buffer)
			.rotate()
			.resize(resize)
			.webp({ quality: 78, effort: 4 })
			.toBuffer();
		const key = `${keyPrefix}/${name}-${shortId()}.webp`;
		variants[name] = await uploadToS3(key, out, "image/webp");
	}

	const blurBuffer = await sharp(buffer)
		.rotate()
		.resize(32)
		.webp({ quality: 40 })
		.toBuffer();
		
	return {
		variants,
		blurDataURL: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
		width: sourceWidth,
		height: sourceHeight,
		alt: alt.slice(0, 240),
	};
}

async function main() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
	const db = mongoose.connection.db;

	let query = {};
	if (sampleSlug) {
		query = { slug: sampleSlug };
		console.log(`Running in sample mode for slug: ${sampleSlug}`);
	}

	const products = await db.collection("products").find(query).toArray();
	console.log(`Found ${products.length} products to check.`);

	const imageCache = new Map(); // Map original URL to processed image object
	let updatedCount = 0;

	for (const product of products) {
		let modified = false;
		console.log(`\nChecking product: ${product.slug}`);

		for (const variant of product.variants) {
			const newImages = [];
			for (const img of variant.images) {
				// We assume the original Woo URL is stored in thumb or full
				const sourceUrl = img.variants?.full;
				if (sourceUrl && sourceUrl.includes("chandnitraders.pk/wp-content")) {
					console.log(`  Found Woo URL: ${sourceUrl}`);
					if (!imageCache.has(sourceUrl)) {
						try {
							const urlPath = new URL(sourceUrl).pathname;
							console.log(`    Downloading via IP...`);
							const buffer = await downloadSecurelyViaIP(urlPath);
							const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 10);
							console.log(`    Processing and uploading to S3...`);
							const processedImg = await processImage(
								buffer,
								`products/${product._id}/${hash}`,
								img.alt || product.name
							);
							imageCache.set(sourceUrl, processedImg);
						} catch (err) {
							console.error(`    Error processing ${sourceUrl}:`, err.message);
							// Push original if it fails so we don't lose it
							newImages.push(img);
							continue;
						}
					}
					newImages.push(imageCache.get(sourceUrl));
					modified = true;
				} else {
					// Already migrated or not a Woo URL
					newImages.push(img);
				}
			}
			variant.images = newImages;
		}

		if (modified) {
			// Rebuild gallery (first image of each variant, deduped, max 8)
			const gallery = [];
			const seen = new Set();
			for (const variant of product.variants) {
				const hero = variant.images[0];
				if (hero && !seen.has(hero.variants.full)) {
					seen.add(hero.variants.full);
					gallery.push(hero);
				}
			}
			product.images = gallery.slice(0, 8);
			product.updatedAt = new Date();

			await db.collection("products").updateOne(
				{ _id: product._id },
				{ $set: { variants: product.variants, images: product.images, updatedAt: product.updatedAt } }
			);
			updatedCount++;
			console.log(`  ✓ Updated product in DB.`);
		} else {
			console.log(`  No update needed.`);
		}
	}

	console.log(`\nMigration complete. ${updatedCount} products updated.`);
	await mongoose.disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
