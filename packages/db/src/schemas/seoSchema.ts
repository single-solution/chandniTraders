import { Schema } from "mongoose";
import { SEO_META_FIELD_LIMITS, type SeoMeta } from "@store/shared";

/**
 * Mongoose embedded sub-schema for the shared `SeoMeta` payload defined
 * in `@store/shared/seo/seoMeta`. Every public entity (Product, Category,
 * Brand, Offer) embeds one. All fields are optional — the storefront
 * `composeSeoMeta(...)` auto-fills anything missing from the entity data +
 * Settings defaults.
 *
 * `_id: false` because there's only ever one `seo` block per parent
 * document and we don't need to address it by id.
 */
export const seoSchema = new Schema<SeoMeta>(
	{
		title: { type: String, trim: true, maxlength: SEO_META_FIELD_LIMITS.title },
		description: {
			type: String,
			trim: true,
			maxlength: SEO_META_FIELD_LIMITS.description,
		},
		canonicalUrl: {
			type: String,
			trim: true,
			maxlength: SEO_META_FIELD_LIMITS.canonicalUrl,
		},
		ogImageUrl: {
			type: String,
			trim: true,
			maxlength: SEO_META_FIELD_LIMITS.ogImageUrl,
		},
		focusKeyword: {
			type: String,
			trim: true,
			maxlength: SEO_META_FIELD_LIMITS.focusKeyword,
		},
		score: { type: Number },
		noindex: { type: Boolean },
		nofollow: { type: Boolean },
	},
	{ _id: false },
);
