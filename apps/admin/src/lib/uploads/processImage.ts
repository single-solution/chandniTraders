/**
 * Server-side image processing for the upload route.
 *
 * Takes one source buffer, runs it through `sharp` four times to
 * produce the WebP variant ladder, generates a tiny base64 blur
 * placeholder, and uploads each artefact through the active
 * `StorageProvider`. The original buffer is discarded after processing
 * — only variants are persisted.
 *
 * Failure handling: if any variant put fails, we best-effort `remove`
 * the variants that did succeed so we don't leak orphans into storage.
 */

import { randomBytes } from "node:crypto";
import type { StorageProvider, StoredImage } from "@store/shared";
import { logger } from "@store/shared";
import sharp from "sharp";

import { BLURHASH_DIMENSION, IMAGE_VARIANT_WIDTHS, MAX_SOURCE_DIMENSION, WEBP_EFFORT, WEBP_QUALITY, type ImageVariantName } from "./limits";

/** Short random suffix that keeps generated object keys unique. */
function shortId(byteCount = 6): string {
	return randomBytes(byteCount).toString("base64url");
}

export interface ProcessImageInput {
	buffer: Buffer;
	/** Provider-relative key prefix, e.g. `products/<id>/variants/<v-id>`. */
	keyPrefix: string;
	/** Alt text to embed on the resulting `StoredImage`. */
	alt: string;
	storage: StorageProvider;
}

export class UploadValidationError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.name = "UploadValidationError";
		this.status = status;
	}
}

/**
 * Generate one variant. Returns the key + buffer + public URL so the
 * caller can collect URLs into the final `StoredImage.variants` map
 * and tear them down on failure.
 */
async function generateVariant(
	source: Buffer,
	name: ImageVariantName,
	width: number,
	keyPrefix: string,
	storage: StorageProvider,
): Promise<{ name: ImageVariantName; key: string; url: string }> {
	const resize =
		name === "thumb"
			? {
					width,
					height: width,
					fit: "cover" as const,
					position: "centre" as const,
					withoutEnlargement: true,
				}
			: { width, withoutEnlargement: true };
	const out = await sharp(source)
		// Auto-orient based on EXIF and strip the EXIF block in the same step.
		.rotate()
		.resize(resize)
		.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
		.toBuffer();
	const key = `${keyPrefix}/${name}-${shortId()}.webp`;
	const url = await storage.put(key, out, "image/webp");
	return { name, key, url };
}

export async function processImage(input: ProcessImageInput): Promise<StoredImage> {
	const { buffer, keyPrefix, alt, storage } = input;
	if (!buffer || buffer.length === 0) {
		throw new UploadValidationError("Empty image buffer", 400);
	}
	const metadata = await sharp(buffer).metadata();
	const sourceWidth = metadata.width ?? 0;
	const sourceHeight = metadata.height ?? 0;
	if (!sourceWidth || !sourceHeight) {
		throw new UploadValidationError("Unable to read image dimensions", 415);
	}
	if (sourceWidth > MAX_SOURCE_DIMENSION || sourceHeight > MAX_SOURCE_DIMENSION) {
		throw new UploadValidationError(`Source image is too large (${sourceWidth}×${sourceHeight}). ` + `Max ${MAX_SOURCE_DIMENSION}px on either axis.`, 413);
	}

	const variantEntries = Object.entries(IMAGE_VARIANT_WIDTHS) as Array<[ImageVariantName, number]>;
	const generated: Array<{ name: ImageVariantName; url: string }> = [];
	try {
		const results = await Promise.all(variantEntries.map(([name, width]) => generateVariant(buffer, name, width, keyPrefix, storage)));
		for (const result of results) {
			generated.push({ name: result.name, url: result.url });
		}

		// Inline blur placeholder. 32×32 WebP @ quality 40 is typically ≤ 300 bytes.
		const blurBuffer = await sharp(buffer).rotate().resize(BLURHASH_DIMENSION).webp({ quality: 40 }).toBuffer();
		const blurDataURL = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

		const variants = generated.reduce<Record<ImageVariantName, string>>(
			(acc, entry) => {
				acc[entry.name] = entry.url;
				return acc;
			},
			{ thumb: "", card: "", detail: "", full: "" },
		);

		return {
			variants,
			blurDataURL,
			width: sourceWidth,
			height: sourceHeight,
			alt,
		};
	} catch (error) {
		// Cleanup partial variants so we don't pay storage for orphans.
		await Promise.allSettled(
			generated.map((entry) =>
				storage.remove(entry.url).catch((removeErr) => {
					logger.warn({ error: removeErr, url: entry.url }, "processImage: cleanup remove() failed");
				}),
			),
		);
		throw error;
	}
}
