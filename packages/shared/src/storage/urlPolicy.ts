/**
 * Allowlist for storage object URLs that may be deleted via admin APIs.
 * Prevents callers from passing arbitrary third-party URLs to `remove()`.
 */

const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isAllowedStorageObjectUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") {
			return false;
		}
		const host = parsed.hostname.toLowerCase();
		if (host.endsWith(VERCEL_BLOB_HOST_SUFFIX)) {
			return true;
		}

		const publicBase = process.env.AWS_S3_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
		if (publicBase && url.startsWith(`${publicBase}/`)) {
			return true;
		}

		const bucket = process.env.AWS_S3_BUCKET?.trim();
		const region = process.env.AWS_S3_REGION?.trim();
		if (bucket && region) {
			const defaultPrefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
			if (url.startsWith(defaultPrefix)) {
				return true;
			}
		}

		return false;
	} catch {
		return false;
	}
}
