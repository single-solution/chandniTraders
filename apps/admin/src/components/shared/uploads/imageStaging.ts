"use client";

import { isStoredImage, type StoredImage } from "@store/shared";

import { uploadImage } from "./uploadClient";

export interface PendingGalleryImage {
	kind: "pending-image";
	id: string;
	file: File;
	previewUrl: string;
	alt: string;
	width: number;
	height: number;
}

export type GalleryImage = StoredImage | PendingGalleryImage;

export function isPendingGalleryImage(image: GalleryImage): image is PendingGalleryImage {
	return "kind" in image && image.kind === "pending-image";
}

export function isPersistedGalleryImage(image: GalleryImage): image is StoredImage {
	return !isPendingGalleryImage(image) && isStoredImage(image);
}

export function getGalleryImageUrl(image: GalleryImage, variant: keyof StoredImage["variants"]): string {
	return isPendingGalleryImage(image) ? image.previewUrl : image.variants[variant];
}

export function getGalleryImageKey(image: GalleryImage): string {
	return isPendingGalleryImage(image) ? image.id : image.variants.thumb;
}

export async function createPendingGalleryImage(file: File, alt: string): Promise<PendingGalleryImage> {
	const previewUrl = URL.createObjectURL(file);
	const dimensions = await readImageDimensions(previewUrl);
	return {
		kind: "pending-image",
		id: `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
		file,
		previewUrl,
		alt,
		width: dimensions.width,
		height: dimensions.height,
	};
}

/** Reuse another variant's gallery in-session (duplicate pending ids for React keys). */
export function cloneGalleryImages(images: GalleryImage[]): GalleryImage[] {
	return images.map((image) => {
		if (isPendingGalleryImage(image)) {
			return {
				...image,
				id: `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
			};
		}
		return structuredClone(image);
	});
}

export async function uploadGalleryImages(
	images: GalleryImage[],
	options: {
		subjectKind?: string;
		subjectId?: string;
	},
): Promise<StoredImage[]> {
	const uploaded: StoredImage[] = [];
	for (const image of images) {
		if (isPersistedGalleryImage(image)) {
			uploaded.push({
				variants: {
					thumb: image.variants.thumb,
					card: image.variants.card,
					detail: image.variants.detail,
					full: image.variants.full,
				},
				blurDataURL: image.blurDataURL,
				width: image.width,
				height: image.height,
				alt: image.alt,
			});
			continue;
		}
		uploaded.push(
			await uploadImage({
				file: image.file,
				altTextBase: image.alt,
				subjectKind: options.subjectKind,
				subjectId: options.subjectId,
			}),
		);
	}
	return uploaded;
}

function readImageDimensions(src: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		};
		image.onerror = () => {
			reject(new Error("Unable to preview selected image."));
		};
		image.src = src;
	});
}
