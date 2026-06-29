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
