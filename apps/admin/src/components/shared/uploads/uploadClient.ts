"use client";

/**
 * Shared client-side helpers for the upload components. Wraps the
 * `POST /api/uploads` and `POST /api/uploads/deletions` endpoints so
 * callers don't repeat the FormData / JSON shapes inline.
 */

import type { StoredImage } from "@store/shared";

export interface UploadImageOptions {
	file: File;
	altTextBase?: string;
	subjectKind?: string;
	subjectId?: string;
}

export interface UploadVideoResult {
	url: string;
	contentType: string;
	sizeBytes: number;
}

export interface UploadVideoOptions {
	file: File;
	subjectKind?: string;
	subjectId?: string;
}

async function postUpload(form: FormData): Promise<unknown> {
	const res = await fetch("/api/uploads", {
		method: "POST",
		body: form,
		credentials: "same-origin",
	});
	if (!res.ok) {
		let message = `Upload failed (${res.status})`;
		try {
			const body = (await res.json()) as { error?: string };
			if (body?.error) message = body.error;
		} catch {
			/* swallow JSON parse errors */
		}
		throw new Error(message);
	}
	return res.json();
}

export async function uploadImage(options: UploadImageOptions): Promise<StoredImage> {
	const form = new FormData();
	form.set("file", options.file);
	form.set("kind", "image");
	if (options.altTextBase) form.set("altTextBase", options.altTextBase);
	if (options.subjectKind) form.set("subjectKind", options.subjectKind);
	if (options.subjectId) form.set("subjectId", options.subjectId);
	return (await postUpload(form)) as StoredImage;
}

export async function uploadVideo(options: UploadVideoOptions): Promise<UploadVideoResult> {
	console.info("[Upload] Initiating direct cloud upload for:", options.file.name, `(${(options.file.size / (1024 * 1024)).toFixed(2)} MB)`);
	const presignForm = new FormData();
	presignForm.set("kind", "presigned");
	presignForm.set("contentType", options.file.type || "video/mp4");
	if (options.subjectKind) presignForm.set("subjectKind", options.subjectKind);
	if (options.subjectId) presignForm.set("subjectId", options.subjectId);

	let presignedRes: { uploadUrl?: string; publicUrl?: string } | null = null;
	try {
		presignedRes = (await postUpload(presignForm)) as { uploadUrl?: string; publicUrl?: string };
		console.info("[Upload] Received presigned ticket from server:", presignedRes);
	} catch (err) {
		console.warn("[Upload] Presign endpoint request failed:", err);
	}

	if (presignedRes?.uploadUrl && presignedRes?.publicUrl) {
		console.info("[Upload] Streaming binary directly to Cloudflare R2...");
		const putRes = await fetch(presignedRes.uploadUrl, {
			method: "PUT",
			body: options.file,
		});
		if (!putRes.ok) {
			const errorText = await putRes.text().catch(() => "");
			console.error("[Upload] Direct R2 PUT failed with status:", putRes.status, errorText);
			throw new Error(`Direct cloud upload failed (${putRes.status}): ${errorText || "Upload rejected by cloud storage."}`);
		}
		console.info("[Upload] Direct cloud upload succeeded! Public URL:", presignedRes.publicUrl);
		return {
			url: presignedRes.publicUrl,
			contentType: options.file.type || "video/mp4",
			sizeBytes: options.file.size,
		};
	}

	// For files larger than 4MB, don't attempt serverless multipart upload
	if (options.file.size > 4 * 1024 * 1024) {
		throw new Error("File exceeds direct upload size limit. Please ensure Cloudflare R2 / S3 storage is configured in Settings -> Integrations.");
	}

	const form = new FormData();
	form.set("file", options.file);
	form.set("kind", "video");
	if (options.subjectKind) form.set("subjectKind", options.subjectKind);
	if (options.subjectId) form.set("subjectId", options.subjectId);
	return (await postUpload(form)) as UploadVideoResult;
}

export async function removeStoredUrls(urls: string[]): Promise<void> {
	if (urls.length === 0) return;
	try {
		await fetch("/api/uploads/deletions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ urls }),
			credentials: "same-origin",
		});
	} catch {
		// Best-effort. Logging happens server-side.
	}
}

export function collectStoredImageUrls(image: StoredImage): string[] {
	return [image.variants.thumb, image.variants.card, image.variants.detail, image.variants.full];
}
