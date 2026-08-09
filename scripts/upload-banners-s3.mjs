import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

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

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_S3_REGION || "auto";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.AWS_S3_ENDPOINT;
const publicUrlBase = process.env.AWS_S3_PUBLIC_URL_BASE?.replace(/\/$/, "");

if (!bucket || !accessKeyId || !secretAccessKey) {
	throw new Error("S3 credentials required");
}

const s3Client = new S3Client({
	region,
	credentials: { accessKeyId, secretAccessKey },
	...(endpoint ? { endpoint, forcePathStyle: true } : {}),
});

function publicUrlForS3Key(key) {
	if (publicUrlBase) {
		return `${publicUrlBase}/${key}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function main() {
	const bannerDir = resolve(repoRoot, "apps/web/public/images");
	const files = readdirSync(bannerDir).filter((f) => f.startsWith("banner"));
	
	const results = {};
	for (const file of files) {
		const filePath = resolve(bannerDir, file);
		const buffer = readFileSync(filePath);
		const key = `banners/${file}`;
		
		const ext = extname(file).toLowerCase();
		const contentType = ext === ".png" ? "image/png" : "image/jpeg";
		
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			})
		);
		const url = publicUrlForS3Key(key);
		console.log(`Uploaded ${file} -> ${url}`);
		results[file] = url;
	}
	
	console.log("\nURLs to use in homeBannerImages.ts:");
	console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
