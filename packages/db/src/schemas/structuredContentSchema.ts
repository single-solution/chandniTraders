import { Schema } from "mongoose";
import { DEFAULT_ICON, STRUCTURED_CONTENT_BULLET_MAX_LENGTH, STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH, type StructuredContent, type StructuredContentBullet } from "@store/shared";

/**
 * Embedded sub-schema for the customer-facing structured content
 * payload (summary + icon-tagged bullets). Shared by Category, Grade,
 * and Offer so a single shape is enforced at the storage layer.
 *
 * `_id: false` because the parent already has identity; nested rows
 * don't need ObjectId churn and we serialize them as a plain array.
 */

const ICON_MAX_LENGTH = 80;

const structuredContentBulletSchema = new Schema<StructuredContentBullet>(
	{
		text: {
			type: String,
			required: true,
			trim: true,
			maxlength: STRUCTURED_CONTENT_BULLET_MAX_LENGTH,
		},
		icon: {
			type: String,
			required: true,
			trim: true,
			maxlength: ICON_MAX_LENGTH,
			default: DEFAULT_ICON,
		},
	},
	{ _id: false },
);

export const structuredContentSchema = new Schema<StructuredContent>(
	{
		summary: {
			type: String,
			required: true,
			trim: true,
			default: "",
			maxlength: STRUCTURED_CONTENT_SUMMARY_MAX_LENGTH,
		},
		bullets: {
			type: [structuredContentBulletSchema],
			required: true,
			default: () => [],
		},
	},
	{ _id: false },
);
