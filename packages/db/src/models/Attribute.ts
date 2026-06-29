import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { slugify } from "@store/shared";

/**
 * Admin-defined single-select filter dimension per category. Variant `attributes`
 * map keys to attribute slugs (e.g. `storage: "128"`).
 */
export const ATTRIBUTE_CARD_POSITIONS = ["image-overlay", "title-chips"] as const;
export type AttributeCardPosition = (typeof ATTRIBUTE_CARD_POSITIONS)[number];

export const ATTRIBUTE_VISIBILITY_TYPES = ["always", "brand", "attribute"] as const;
export type AttributeVisibilityType = (typeof ATTRIBUTE_VISIBILITY_TYPES)[number];

export interface AttributeVisibility {
	type: AttributeVisibilityType;
	brandSlugs?: string[];
	attributeSlug?: string;
	optionValues?: string[];
}

export interface AttributeOption {
	/**
	 * Canonical slug persisted on the variant (`attributes[attributeSlug]`).
	 * Auto-derived from option `label` + parent attribute `unit`.
	 */
	value: string;
	/** Primary display segment (e.g. "256"). */
	label: string;
}

export interface AttributeAttributes {
	categorySlug: string;
	slug: string;
	label: string;
	/** Shared suffix for every option (e.g. "gb" on a Storage attribute). */
	unit?: string;
	options: AttributeOption[];
	/** When this attribute appears in filters / variant UI (default: always). */
	visibility?: AttributeVisibility;
	cardPosition: AttributeCardPosition;
	isActive: boolean;
}

const attributeVisibilitySchema = new Schema<AttributeVisibility>(
	{
		type: {
			type: String,
			enum: ATTRIBUTE_VISIBILITY_TYPES,
			required: true,
			default: "always",
		},
		brandSlugs: [{ type: String, trim: true, lowercase: true }],
		attributeSlug: { type: String, trim: true, lowercase: true },
		optionValues: [{ type: String, trim: true, lowercase: true }],
	},
	{ _id: false },
);

const ATTRIBUTE_VALUE_MAX_LENGTH = 80;
const ATTRIBUTE_LABEL_MAX_LENGTH = 80;
const CATEGORY_SLUG_MAX_LENGTH = 60;
const ATTRIBUTE_SLUG_MAX_LENGTH = 60;
const UNIT_MAX_LENGTH = 20;

const attributeOptionSchema = new Schema<AttributeOption>(
	{
		value: { type: String, required: true, trim: true, maxlength: ATTRIBUTE_VALUE_MAX_LENGTH },
		label: { type: String, required: true, trim: true, maxlength: ATTRIBUTE_LABEL_MAX_LENGTH },
	},
	{ _id: false },
);

const attributeSchema = new Schema<AttributeAttributes>(
	{
		categorySlug: {
			type: String,
			required: true,
			lowercase: true,
			trim: true,
			maxlength: CATEGORY_SLUG_MAX_LENGTH,
		},
		slug: {
			type: String,
			required: true,
			lowercase: true,
			trim: true,
			maxlength: ATTRIBUTE_SLUG_MAX_LENGTH,
		},
		label: { type: String, required: true, trim: true, maxlength: ATTRIBUTE_LABEL_MAX_LENGTH },
		unit: { type: String, trim: true, maxlength: UNIT_MAX_LENGTH },
		options: {
			type: [attributeOptionSchema],
			required: true,
			validate: {
				validator: (value: AttributeOption[]) => Array.isArray(value) && value.length > 0,
				message: "Attribute must have at least one option.",
			},
		},
		visibility: {
			type: attributeVisibilitySchema,
			default: () => ({ type: "always" as const }),
		},
		cardPosition: {
			type: String,
			enum: ATTRIBUTE_CARD_POSITIONS,
			required: true,
			default: "title-chips",
		},
		isActive: { type: Boolean, required: true, default: true },
	},
	{ timestamps: true },
);

attributeSchema.pre<HydratedDocument<AttributeAttributes>>("validate", async function attributeSlugAutogen() {
	if (this?.slug && this.slug.length > 0) {
		return;
	}
	if (!this?.label) {
		return;
	}
	this.slug = slugify(this.label, ATTRIBUTE_SLUG_MAX_LENGTH);
});

attributeSchema.index({ categorySlug: 1, slug: 1 }, { unique: true });
attributeSchema.index({ categorySlug: 1, isActive: 1 });

export const Attribute: Model<AttributeAttributes> = (mongoose.models.Attribute as Model<AttributeAttributes>) ?? mongoose.model<AttributeAttributes>("Attribute", attributeSchema);
