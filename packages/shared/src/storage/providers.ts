/**
 * Storage provider abstraction — credentials from Admin → Integrations (env fallback).
 */

import type { IntegrationSettingsValues } from "../integration/integrationSettingsSchema";

export interface StorageProvider {
	put(key: string, body: Buffer, contentType: string): Promise<string>;
	remove(url: string): Promise<void>;
}

function readS3Config(settings?: IntegrationSettingsValues) {
	const bucket = settings?.awsS3Bucket?.trim() || process.env.AWS_S3_BUCKET?.trim();
	const region = settings?.awsS3Region?.trim() || process.env.AWS_S3_REGION?.trim();
	const accessKeyId = settings?.awsAccessKeyId?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = settings?.awsSecretAccessKey?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();
	// Present for S3-compatible stores (Cloudflare R2, MinIO, …); empty = native AWS S3.
	const endpoint = settings?.awsS3Endpoint?.trim() || process.env.AWS_S3_ENDPOINT?.trim() || undefined;
	if (!bucket || !region || !accessKeyId || !secretAccessKey) {
		throw new Error("S3 storage requires bucket, region, and AWS credentials.");
	}
	return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

/** S3Client options, extended with a custom endpoint + path-style for R2/MinIO. */
function s3ClientConfig(config: { region: string; accessKeyId: string; secretAccessKey: string; endpoint?: string }) {
	return {
		region: config.region,
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
		...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
	};
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

/** Product images and uploads go to an S3-compatible bucket (Cloudflare R2 in production). */
export function resolveStorageProviderFromSettings(settings?: IntegrationSettingsValues): StorageProvider {
	return {
		async put(key, body, contentType) {
			const { bucket, region, endpoint, ...credentials } = readS3Config(settings);
			const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
			const client = new S3Client(s3ClientConfig({ region, endpoint, ...credentials }));
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
			const { bucket, region, endpoint, ...credentials } = readS3Config(settings);
			const key = s3KeyFromPublicUrl(url, bucket, region, settings);
			if (!key) {
				return;
			}
			const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
			const client = new S3Client(s3ClientConfig({ region, endpoint, ...credentials }));
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
