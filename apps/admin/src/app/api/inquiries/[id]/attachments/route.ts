/**
 * POST /api/inquiries/[id]/attachments
 *
 * Admin attaches an image or file to a chat reply. Behaves like the
 * regular reply endpoint (auto-claim, status flip, counters) but the
 * message also carries one attachment. Gated by `inquiry_reply` (the
 * same permission that controls regular message replies; `inquiry_manage`
 * expands to include `inquiry_reply` so managers also pass).
 *
 * Image uploads are content-sniffed against magic bytes before trust —
 * an attacker cannot ship an executable with a forged `image/png`
 * Content-Type label.
 */

import { Inquiry, connectDB } from "@store/db";
import {
	assertContentTypeMatches,
	badRequest,
	created,
	inquiryStatusPatchAfterMessage,
	logger,
	notFound,
	payloadTooLarge,
	serverError,
	SNIFF_BYTE_COUNT,
	unsupportedMediaType,
} from "@store/shared";
import { resolveStorageProvider } from "@store/shared/server";

import { requireSession } from "@/lib/api/requireSession";
import { recordActivity } from "@/lib/services/activityLog";
import { toInquiryLatestPage, type InquiryLean } from "@/lib/serializers/inquiry";
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES, MAX_IMAGE_MB, MAX_VIDEO_BYTES, MAX_VIDEO_MB } from "@/lib/uploads/limits";
import { processImage, UploadValidationError } from "@/lib/uploads/processImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILE_MIME = [
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/plain",
] as const;

interface RouteContext {
	params: Promise<{ id: string }>;
}

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Verify a non-image upload's leading bytes match its declared MIME so a
 * forged Content-Type can't smuggle arbitrary content past the allowlist.
 * `text/plain` has no reliable signature, so it's accepted as-is.
 */
function fileSignatureMatches(buffer: Buffer, mime: string): boolean {
	const startsWith = (signature: number[]): boolean => signature.every((byte, index) => buffer[index] === byte);
	switch (mime) {
		case "application/pdf":
			return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return startsWith([0x50, 0x4b, 0x03, 0x04]); // PK.. (Office Open XML = ZIP)
		case "application/msword":
		case "application/vnd.ms-excel":
			return startsWith([0xd0, 0xcf, 0x11, 0xe0]); // OLE2 compound file
		case "text/plain":
			return true;
		default:
			return false;
	}
}

export async function POST(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("inquiry_reply");
	if (response) return response;

	const { id } = await params;

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

	const body = formData.get("body")?.toString().trim() ?? "";
	const fileType = file.type;
	const isImage = (ALLOWED_IMAGE_MIME as readonly string[]).includes(fileType);
	const isFile = (ALLOWED_FILE_MIME as readonly string[]).includes(fileType);

	if (!isImage && !isFile) {
		return unsupportedMediaType(`Unsupported type "${fileType}".`);
	}

	if (isImage && file.size > MAX_IMAGE_BYTES) {
		return payloadTooLarge(`Image exceeds ${MAX_IMAGE_MB} MB.`);
	}
	if (isFile && file.size > MAX_VIDEO_BYTES) {
		return payloadTooLarge(`File exceeds ${MAX_VIDEO_MB} MB.`);
	}

	await connectDB();
	const existing = await Inquiry.findById(id).lean<InquiryLean>();
	if (!existing) {
		return notFound("Inquiry not found");
	}

	try {
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		if (isImage) {
			const sniffError = assertContentTypeMatches(buffer.subarray(0, SNIFF_BYTE_COUNT), fileType);
			if (sniffError) {
				return unsupportedMediaType(sniffError);
			}
		} else if (!fileSignatureMatches(buffer, fileType)) {
			return unsupportedMediaType(`File contents do not match declared type "${fileType}".`);
		}
		const storage = await resolveStorageProvider();
		const MAX_SAFE_FILENAME = 200;
		const MAX_STORED_FILENAME = 240;
		const MSG_PREVIEW_MAX_LENGTH = 280;
		const keyPrefix = `chat/${existing._id.toString()}/${todayIsoDate()}`;

		const previewBody = body || (isImage ? "(image)" : `(${file.name})`);
		const now = new Date();
		let attachment;
		if (isImage) {
			const stored = await processImage({
				buffer,
				keyPrefix,
				alt: body || file.name.replace(/\.[^.]+$/, ""),
				storage,
			});
			attachment = { kind: "image" as const, image: stored };
		} else {
			const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, MAX_SAFE_FILENAME);
			const key = `${keyPrefix}/file-${Date.now().toString(36)}-${safeName}`;
			const url = await storage.put(key, buffer, fileType);
			attachment = {
				kind: "file" as const,
				url,
				mime: fileType,
				sizeBytes: buffer.length,
				filename: file.name.slice(0, MAX_STORED_FILENAME),
			};
		}

		await Inquiry.updateOne(
			{ _id: existing._id },
			{
				$push: {
					messages: {
						author: "agent",
						authorName: actor.name,
						authorUserId: actor.id,
						body: body || (isImage ? "📷" : "📎"),
						attachments: [attachment],
						createdAt: now,
					},
				},
				$set: {
					lastMessageAt: now,
					lastMessagePreview: previewBody.slice(0, MSG_PREVIEW_MAX_LENGTH),
					lastMessageAuthor: "agent",
					unreadByTeam: 0,
					...inquiryStatusPatchAfterMessage(existing?.status, "team"),
					...(existing?.assignedToUserId ? {} : { assignedToUserId: actor.id }),
				},
				$inc: { unreadByCustomer: 1 },
			},
		);

		const refreshed = await Inquiry.findById(existing._id).lean<InquiryLean>();
		if (!refreshed) {
			return serverError("Inquiry vanished");
		}
		const label = refreshed.subjectProductName ? `${refreshed.customerName} · ${refreshed.subjectProductName}` : refreshed.customerName;
		await recordActivity({
			actor,
			action: "updated",
			resourceType: "inquiry",
			resourceId: id,
			resourceLabel: label,
			detail: "Sent attachment",
		});
		return created(toInquiryLatestPage(refreshed));
	} catch (error) {
		if (error instanceof UploadValidationError) {
			if (error.status === 413) return payloadTooLarge(error.message);
			if (error.status === 415) return unsupportedMediaType(error.message);
			return badRequest(error.message);
		}
		logger.error({ error, inquiryId: id }, "Failed to attach admin upload");
		return serverError("Upload failed. Please try again.");
	}
}
