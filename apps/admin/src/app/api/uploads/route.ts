/**
 * Admin upload endpoint.
 *
 * - `kind=image` (default): runs `processImage` to generate the four
 *   WebP variants + blurhash and returns a fully-formed `StoredImage`.
 * - `kind=video`: bypasses image processing and stores the original
 *   file directly. Returns `{ url, contentType, sizeBytes }` so the
 *   caller can persist a `Grade.video` URL.
 *
 * Multipart form fields:
 *   - `file`        — required, single file payload
 *   - `kind`        — "image" | "video" (default "image")
 *   - `altTextBase` — optional base alt text for images
 *   - `subjectKind` — short label used in the storage key (e.g.
 *                     "products", "categories", "offers")
 *   - `subjectId`   — optional id for the storage key prefix
 *
 * Content is verified by sniffing the file's magic bytes before
 * trusting the browser-supplied MIME (`security.md` § File Upload).
 */

import { assertContentTypeMatches, badRequest, logger, ok, payloadTooLarge, serverError, SNIFF_BYTE_COUNT, unsupportedMediaType } from "@store/shared";
import { resolveStorageProvider } from "@store/shared/server";

import { requireSession } from "@/lib/api/requireSession";
import {
	ALLOWED_IMAGE_MIME,
	ALLOWED_VIDEO_MIME,
	MAX_IMAGE_BYTES,
	MAX_IMAGE_MB,
	MAX_VIDEO_BYTES,
	MAX_VIDEO_MB,
	type AllowedImageMime,
	type AllowedVideoMime,
} from "@/lib/uploads/limits";
import { processImage, UploadValidationError } from "@/lib/uploads/processImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

const MAX_SEGMENT_LENGTH = 64;

function sanitizeSegment(value: string | null | undefined): string | null {
	if (!value) return null;
	const cleaned = value
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SEGMENT_LENGTH);
	return cleaned.length > 0 ? cleaned : null;
}

function buildKeyPrefix(subjectKind: string | null, subjectId: string | null): string {
	const segments: string[] = [];
	segments.push(sanitizeSegment(subjectKind) ?? "uploads");
	if (subjectId) {
		const cleanedId = sanitizeSegment(subjectId);
		if (cleanedId) segments.push(cleanedId);
	}
	segments.push(todayIsoDate());
	return segments.join("/");
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("media_upload");
	if (response) return response;
	const userId = actor.id;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return badRequest("Expected multipart/form-data body.");
	}

	const file = formData.get("file");
	if (!(file instanceof File)) {
		return badRequest("Missing `file` field in multipart form data.");
	}

	const kindRaw = (formData.get("kind") ?? "image").toString().toLowerCase();
	const kind = kindRaw === "video" ? "video" : "image";

	const subjectKind = formData.get("subjectKind")?.toString() ?? null;
	const subjectId = formData.get("subjectId")?.toString() ?? null;
	const altTextBase = formData.get("altTextBase")?.toString().trim() ?? "";
	const fileType = file.type;
	const fileSize = file.size;

	try {
		if (kind === "image") {
			if (!ALLOWED_IMAGE_MIME.includes(fileType as AllowedImageMime)) {
				return unsupportedMediaType(`Unsupported image type "${fileType}". Allowed: ${ALLOWED_IMAGE_MIME.join(", ")}.`);
			}
			if (fileSize > MAX_IMAGE_BYTES) {
				return payloadTooLarge(`Image exceeds ${MAX_IMAGE_MB} MB.`);
			}
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const sniffError = assertContentTypeMatches(buffer.subarray(0, SNIFF_BYTE_COUNT), fileType);
			if (sniffError) {
				return unsupportedMediaType(sniffError);
			}
			const storage = await resolveStorageProvider();
			const keyPrefix = buildKeyPrefix(subjectKind, subjectId);
			const stored = await processImage({
				buffer,
				keyPrefix,
				alt: altTextBase || file.name.replace(/\.[^.]+$/, ""),
				storage,
			});
			logger.info(
				{
					userId,
					subjectKind,
					subjectId,
					width: stored.width,
					height: stored.height,
				},
				"uploads: image stored",
			);
			return ok(stored);
		}

		if (!ALLOWED_VIDEO_MIME.includes(fileType as AllowedVideoMime)) {
			return unsupportedMediaType(`Unsupported video type "${fileType}". Allowed: ${ALLOWED_VIDEO_MIME.join(", ")}.`);
		}
		if (fileSize > MAX_VIDEO_BYTES) {
			return payloadTooLarge(`Video exceeds ${MAX_VIDEO_MB} MB.`);
		}
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const sniffError = assertContentTypeMatches(buffer.subarray(0, SNIFF_BYTE_COUNT), fileType);
		if (sniffError) {
			return unsupportedMediaType(sniffError);
		}
		const storage = await resolveStorageProvider();
		const keyPrefix = buildKeyPrefix(subjectKind, subjectId);
		const extension = fileType === "video/webm" ? "webm" : "mp4";
		const RADIX_BASE36 = 36;
		const key = `${keyPrefix}/video-${Date.now().toString(RADIX_BASE36)}.${extension}`;
		const url = await storage.put(key, buffer, fileType);
		logger.info({ userId, subjectKind, subjectId, sizeBytes: buffer.length }, "uploads: video stored");
		return ok({ url, contentType: fileType, sizeBytes: buffer.length });
	} catch (error) {
		if (error instanceof UploadValidationError) {
			return uploadValidationResponse(error);
		}
		logger.error({ error, userId, kind, subjectKind, subjectId }, "uploads: processing failed");
		return serverError("Upload failed. Please try again.");
	}
}

/** Map `UploadValidationError.status` back to the matching shared helper. */
function uploadValidationResponse(error: UploadValidationError) {
	if (error.status === 413) return payloadTooLarge(error.message);
	if (error.status === 415) return unsupportedMediaType(error.message);
	return badRequest(error.message);
}
