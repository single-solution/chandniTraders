import { isStoredImage, MAX_PRODUCT_IMAGES, type StoredImage } from "@store/shared";

function toStoredImagePayload(value: unknown): StoredImage | null {
	if (!isStoredImage(value)) return null;
	return {
		variants: {
			thumb: value.variants.thumb,
			card: value.variants.card,
			detail: value.variants.detail,
			full: value.variants.full,
		},
		blurDataURL: value.blurDataURL,
		width: value.width,
		height: value.height,
		alt: value.alt,
	};
}

type ProductImagesValidationResult = { ok: true; value: StoredImage[] } | { ok: false; error: string };

export interface ValidateProductImagesOptions {
	/** When `true`, an empty payload is rejected — used on product create
	 *  with variants and on the dedicated `PUT .../images` route. */
	required?: boolean;
}

export function validateProductImages(raw: unknown, options?: ValidateProductImagesOptions): ProductImagesValidationResult {
	const required = options?.required ?? false;

	if (raw === undefined || raw === null) {
		if (required) {
			return { ok: false, error: "Add at least one product photo." };
		}
		return { ok: true, value: [] };
	}

	if (!Array.isArray(raw)) {
		return { ok: false, error: "images must be an array." };
	}

	if (raw.length === 0) {
		if (required) {
			return { ok: false, error: "Add at least one product photo." };
		}
		return { ok: true, value: [] };
	}

	if (raw.length > MAX_PRODUCT_IMAGES) {
		return {
			ok: false,
			error: `Product cannot have more than ${MAX_PRODUCT_IMAGES} photos.`,
		};
	}

	const normalised: StoredImage[] = [];
	for (const image of raw) {
		const stored = toStoredImagePayload(image);
		if (!stored) {
			return {
				ok: false,
				error: "One or more images is not a valid StoredImage payload. Upload through /api/uploads.",
			};
		}
		normalised.push(stored);
	}

	return { ok: true, value: normalised };
}
