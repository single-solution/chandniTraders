import { Schema } from "mongoose";
import type { StoredImage, StoredImageVariants } from "@store/shared";

/**
 * Mongoose embedded sub-schema for the shared `StoredImage` payload
 * defined in `@store/shared/storage/types`. Every model that persists an
 * image field reuses this exact sub-schema — Offer (banner), Variant
 * (images[]), Inquiry (message attachments), Setting (logo, favicon,
 * OG default, via the value blob).
 *
 * One definition, one shape, one validator — no per-model drift.
 *
 * `_id: false` because the parent document already has identity; nested
 * image records don't need their own ObjectId churn (and dropping them
 * keeps the on-disk payload small, which matters when a Variant has 8
 * images × every product).
 */

const MIN_IMAGE_DIMENSION = 1;
const ALT_TEXT_MAX_LENGTH = 240;

const storedImageVariantsSchema = new Schema<StoredImageVariants>(
	{
		thumb: { type: String, required: true, trim: true },
		card: { type: String, required: true, trim: true },
		detail: { type: String, required: true, trim: true },
		full: { type: String, required: true, trim: true },
	},
	{ _id: false },
);

export const storedImageSchema = new Schema<StoredImage>(
	{
		variants: { type: storedImageVariantsSchema, required: true },
		blurDataURL: { type: String, required: true, trim: true },
		width: { type: Number, required: true, min: MIN_IMAGE_DIMENSION },
		height: { type: Number, required: true, min: MIN_IMAGE_DIMENSION },
		alt: { type: String, required: true, trim: true, maxlength: ALT_TEXT_MAX_LENGTH },
	},
	{ _id: false },
);
