import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { slugify } from "@store/shared";
import type { SeoMeta, StoredImage, StructuredContent } from "@store/shared";
import { seoSchema } from "../schemas/seoSchema";
import { storedImageSchema } from "../schemas/storedImageSchema";
import { structuredContentSchema } from "../schemas/structuredContentSchema";
import { offerConditionSchema, offerActionSchema, offerScheduleSchema, offerConstraintsSchema } from "../schemas/offerRulesSchema";
import type { OfferCondition, OfferAction, OfferSchedule, OfferConstraints } from "@store/shared";

/**
 * Promotional offer surfaced on the home offers strip and (optionally)
 * on category landing pages. Badge color is a free-form hex `color`.
 */
export interface OfferAttributes {
	slug: string;
	title: string;
	description: string;
	discountLabel: string;
	badgeLabel: string;
	color: string;
	isActive: boolean;
	sortOrder: number;
	bannerImage?: StoredImage;
	/** Optional structured copy (summary + icon-tagged bullets). */
	content?: StructuredContent;
	/** Optional per-offer SEO overrides (auto-filled when absent). */
	seo?: SeoMeta;

	// Rules Engine
	conditions: OfferCondition[];
	action: OfferAction;
	schedule: OfferSchedule;
	constraints: OfferConstraints;
}

const OFFER_SLUG_MAX_LENGTH = 96;
const OFFER_TITLE_MAX_LENGTH = 160;
const OFFER_DESC_MAX_LENGTH = 400;
const DISCOUNT_LABEL_MAX_LENGTH = 60;
const BADGE_LABEL_MAX_LENGTH = 60;
const HEX_COLOR_LENGTH = 7;

const offerSchema = new Schema<OfferAttributes>(
	{
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			maxlength: OFFER_SLUG_MAX_LENGTH,
			index: true,
		},
		title: { type: String, required: true, trim: true, maxlength: OFFER_TITLE_MAX_LENGTH },
		description: { type: String, required: true, trim: true, maxlength: OFFER_DESC_MAX_LENGTH },
		discountLabel: { type: String, required: true, trim: true, maxlength: DISCOUNT_LABEL_MAX_LENGTH },
		badgeLabel: { type: String, required: true, trim: true, maxlength: BADGE_LABEL_MAX_LENGTH },
		color: {
			type: String,
			required: true,
			trim: true,
			maxlength: HEX_COLOR_LENGTH,
			match: /^#[0-9a-f]{6}$/i,
			default: "#e1ff51",
		},
		isActive: { type: Boolean, required: true, default: true },
		sortOrder: { type: Number, required: true, default: 0 },
		bannerImage: { type: storedImageSchema, required: false },
		content: { type: structuredContentSchema, required: false, default: undefined },
		seo: { type: seoSchema, default: () => ({}) },
		conditions: { type: [offerConditionSchema], required: true, default: [] },
		action: { type: offerActionSchema, required: true },
		schedule: { type: offerScheduleSchema, required: true, default: () => ({}) },
		constraints: { type: offerConstraintsSchema, required: true, default: () => ({ allowLoyaltyPoints: false, isStackable: false, usageCount: 0 }) },
	},
	{ timestamps: true },
);

offerSchema.pre<HydratedDocument<OfferAttributes>>("validate", async function offerSlugAutogen() {
	if (this?.slug && this.slug.length > 0) {
		return;
	}
	if (!this?.title) {
		return;
	}
	this.slug = slugify(this.title, OFFER_SLUG_MAX_LENGTH);
});

offerSchema.pre<HydratedDocument<OfferAttributes>>("validate", function enforceSingleOfferPolicy() {
	if (this?.constraints) {
		this.constraints.isStackable = false;
	}
});

offerSchema.index({ sortOrder: 1, createdAt: -1 });

export const Offer: Model<OfferAttributes> = (mongoose.models.Offer as Model<OfferAttributes>) ?? mongoose.model<OfferAttributes>("Offer", offerSchema);
