/**
 * Static limits + variant ladder for the upload pipeline.
 *
 * The numbers here match upload pipeline limits. Each variant
 * targets a specific surface so the storefront never pulls a 2400w hero
 * to render a 96px gallery thumbnail.
 */

export const MAX_IMAGE_MB = 12;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
export const MAX_SOURCE_DIMENSION = 4000;
export const MAX_VIDEO_MB = 64;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"] as const;
export type AllowedVideoMime = (typeof ALLOWED_VIDEO_MIME)[number];

/**
 * Variant ladder. `withoutEnlargement: true` is used at processing time
 * so we never upscale — a 400w source still produces a 400w `card` and
 * `detail` (sharp clamps), and `full` falls back to the source width.
 */
export const IMAGE_VARIANT_WIDTHS = {
	thumb: 160,
	card: 480,
	detail: 1080,
	full: 2400,
} as const;
export type ImageVariantName = keyof typeof IMAGE_VARIANT_WIDTHS;

export const WEBP_QUALITY = 78;
export const WEBP_EFFORT = 4;

/** Dimension (square) used to generate the inline blur placeholder. */
export const BLURHASH_DIMENSION = 32;

/** Number of upload requests allowed per minute per actor. */
export const UPLOAD_RATE_LIMIT_PER_MINUTE = 30;
