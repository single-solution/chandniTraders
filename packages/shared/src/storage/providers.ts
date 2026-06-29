/**
 * Storage provider abstraction — credentials from Admin → Integrations (env fallback).
 */

import type { IntegrationSettingsValues } from "../integration/integrationSettingsSchema";

export interface StorageProvider {
	put(key: string, body: Buffer, contentType: string): Promise<string>;
	remove(url: string): Promise<void>;
}

export type StorageProviderName = "vercel-blob" | "s3";

const DEFAULT_PROVIDER_NAME: StorageProviderName = "vercel-blob";

function readProviderName(settings?: IntegrationSettingsValues): StorageProviderName {
	const raw = (settings?.storageProvider || process.env.STORAGE_PROVIDER)?.trim().toLowerCase();
	if (!raw) {
		return DEFAULT_PROVIDER_NAME;
	}
	if (raw === "vercel-blob" || raw === "s3") {
		return raw;
	}
	throw new Error(`Unsupported storage provider "${raw}". Expected vercel-blob or s3.`);
}

function readS3Config(settings?: IntegrationSettingsValues) {
	const bucket = settings?.awsS3Bucket?.trim() || process.env.AWS_S3_BUCKET?.trim();
	const region = settings?.awsS3Region?.trim() || process.env.AWS_S3_REGION?.trim();
	const accessKeyId = settings?.awsAccessKeyId?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = settings?.awsSecretAccessKey?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();
	if (!bucket || !region || !accessKeyId || !secretAccessKey) {
		throw new Error("S3 storage requires bucket, region, and AWS credentials.");
	}
	return { bucket, region, accessKeyId, secretAccessKey };
}

function readBlobToken(settings?: IntegrationSettingsValues): string {
	const token = settings?.blobReadWriteToken?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim();
	if (!token) {
		throw new Error("Blob read/write token is not configured.");
	}
	return token;
}

function publicUrlForS3Key(key: string, bucket: string, region: string, settings?: IntegrationSettingsValues): string {
	const publicBase = (settings?.awsS3PublicUrlBase?.trim() || process.env.AWS_S3_PUBLIC_URL_BASE?.trim())?.replace(/\/$/, "");
	if (publicBase) {
		return `${publicBase}/${key}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function s3KeyFromPublicUrl(url: string, bucket: string, region: string, settings?: IntegrationSettingsValues): string | null {
	const publicBase = (settings?.awsS3PublicUrlBase?.trim() || process.env.AWS_S3_PUBLIC_URL_BASE?.trim())?.replace(/\/$/, "");
	if (publicBase && url.startsWith(`${publicBase}/`)) {
		return url.slice(publicBase.length + 1);
	}
	const defaultPrefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
	if (url.startsWith(defaultPrefix)) {
		return url.slice(defaultPrefix.length);
	}
	return null;
}

export function resolveStorageProviderFromSettings(settings?: IntegrationSettingsValues): StorageProvider {
	const name = readProviderName(settings);

	if (name === "vercel-blob") {
		return {
			async put(key, body, contentType) {
				const token = readBlobToken(settings);
				const { put } = await import("@vercel/blob");
				const result = await put(key, body, {
					access: "public",
					contentType,
					addRandomSuffix: false,
					token,
				});
				return result.url;
			},
			async remove(url) {
				const token = readBlobToken(settings);
				const { del } = await import("@vercel/blob");
				try {
					await del(url, { token });
				} catch (error) {
					const message = error instanceof Error ? error.message.toLowerCase() : "";
					if (message.includes("not found") || message.includes("does not exist")) {
						return;
					}
					throw error;
				}
			},
		};
	}

	return {
		async put(key, body, contentType) {
			const { bucket, region, accessKeyId, secretAccessKey } = readS3Config(settings);
			const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
			const client = new S3Client({
				region,
				credentials: { accessKeyId, secretAccessKey },
			});
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
				}),
			);
			return publicUrlForS3Key(key, bucket, region, settings);
		},
		async remove(url) {
			const { bucket, region, accessKeyId, secretAccessKey } = readS3Config(settings);
			const key = s3KeyFromPublicUrl(url, bucket, region, settings);
			if (!key) {
				return;
			}
			const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
			const client = new S3Client({
				region,
				credentials: { accessKeyId, secretAccessKey },
			});
			try {
				await client.send(
					new DeleteObjectCommand({
						Bucket: bucket,
						Key: key,
					}),
				);
			} catch (error) {
				const message = error instanceof Error ? error.message.toLowerCase() : "";
				if (message.includes("not found") || message.includes("nosuchkey")) {
					return;
				}
				throw error;
			}
		},
	};
}
