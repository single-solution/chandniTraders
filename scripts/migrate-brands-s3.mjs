import { createHash } from "node:crypto";
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

async function downloadSecurelyViaIP(urlPath) {
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
				rejectUnauthorized: false,
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

async function processLogo(buffer, keyPrefix) {
	const out = await sharp(buffer)
		.webp({ quality: 85, effort: 4 })
		.toBuffer();
	const key = `${keyPrefix}/logo.webp`;
	return await uploadToS3(key, out, "image/webp");
}

async function main() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
	const db = mongoose.connection.db;

	const brands = await db.collection("brands").find({}).toArray();
	console.log(`Found ${brands.length} brands to check.`);

	let updatedCount = 0;

	for (const brand of brands) {
		const sourceUrl = brand.logoUrl;
		if (sourceUrl && sourceUrl.includes("chandnitraders.pk/wp-content")) {
			console.log(`\nMigrating brand logo: ${brand.slug}`);
			try {
				const urlPath = new URL(sourceUrl).pathname;
				console.log(`  Downloading via IP...`);
				const buffer = await downloadSecurelyViaIP(urlPath);
				const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 10);
				console.log(`  Processing and uploading to S3...`);
				
				const newUrl = await processLogo(buffer, `brands/${brand.slug}/${hash}`);
				
				await db.collection("brands").updateOne(
					{ _id: brand._id },
					{ $set: { logoUrl: newUrl, updatedAt: new Date() } }
				);
				updatedCount++;
				console.log(`  ✓ Updated brand ${brand.slug} in DB.`);
			} catch (err) {
				console.error(`  Error processing ${sourceUrl}:`, err.message);
			}
		} else {
			console.log(`Brand ${brand.slug} logo URL does not need migration.`);
		}
	}

	console.log(`\nBrand migration complete. ${updatedCount} brands updated.`);
	await mongoose.disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
