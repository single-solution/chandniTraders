/**
 * Per-resource field length limits shared between list and detail handlers
 * for the same resource. Centralised so the POST and PUT handlers can't
 * drift into accepting different lengths for the same field.
 *
 * Keep in lockstep with the equivalent `maxlength` declarations in the
 * Mongoose schemas under `packages/db/src/models/`.
 */

export const PRODUCT_FIELD_LIMITS = {
	name: 120,
	slug: 96,
} as const;

export const OFFER_FIELD_LIMITS = {
	title: 160,
	description: 400,
	discountLabel: 60,
	badgeLabel: 60,
} as const;

export const BRAND_FIELD_LIMITS = {
	name: 100,
	/** Mirrors the default `slugify` cap — keep in sync if that default changes. */
	slug: 64,
} as const;

export const CATEGORY_FIELD_LIMITS = {
	label: 60,
	description: 280,
} as const;

export const ATTRIBUTE_FIELD_LIMITS = {
	label: 80,
	optionLabel: 80,
	unit: 20,
	/** Cap on number of options stored per attribute — mirrors UI list cap. */
	optionCount: 32,
} as const;
