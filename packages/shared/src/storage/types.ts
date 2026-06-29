/**
 * Shared types for the storage / image pipeline. Image fields on models use
 * `StoredImage` (or arrays) — raw `imageUrl: string` is forbidden.
 */

/**
 * Pre-rendered WebP variants generated server-side on upload. Every URL is
 * the right size for its consumer — no `?w=480&q=75` runtime params — which
 * keeps CDN cache-hit ratio near 100% and removes runtime optimization cost.
 *
 *   - `thumb`  : ≤  160w — admin gallery thumbnails, hero badge crops, OG-card collage tiles.
 *   - `card`   : ≤  480w — storefront `ProductCard` hero, related-product rails, mobile PDP hero.
 *   - `detail` : ≤ 1080w — desktop / tablet PDP hero, dynamic OG image input.
 *   - `full`   : ≤ 2400w — lightbox / zoom view; ALSO the source if upload ≤ 2400w.
 */
export interface StoredImageVariants {
	thumb: string;
	card: string;
	detail: string;
	full: string;
}

/**
 * The canonical image record. Persisted as an embedded sub-document on
 * every model that needs an image. Storage-agnostic by design — the
 * `variants.*` URLs are plain HTTPS strings, so the same `StoredImage` can
 * point at `*.public.blob.vercel-storage.com` today and `cdn.<domain>`
 * (S3 + CloudFront) tomorrow without touching the schema or any renderer.
 *
 * `width`/`height` are SOURCE dimensions (needed by `next/image` to reserve
 * layout space and prevent CLS). `blurDataURL` is a ~200-byte base64 32×32
 * blur that inlines into the HTML for instant placeholders.
 */
export interface StoredImage {
	variants: StoredImageVariants;
	blurDataURL: string;
	width: number;
	height: number;
	alt: string;
}

/**
 * Variant keys exposed at the type level so renderers can switch on them
 * without magic strings.
 */
export type StoredImageVariantKey = keyof StoredImageVariants;

function readFiniteDimension(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalise a persisted / wire image payload into a strict `StoredImage`.
 * More lenient than `isStoredImage` — used when reading Mongo lean docs
 * where numeric fields may arrive as strings.
 */
const MIN_IMAGE_DIMENSION = 1;

export function coerceStoredImage(value: unknown): StoredImage | null {
	if (value === null || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const rawVariants = raw.variants;
	if (rawVariants === null || typeof rawVariants !== "object") return null;
	const variants = rawVariants as Record<string, unknown>;
	const thumb = typeof variants.thumb === "string" ? variants.thumb.trim() : "";
	const card = typeof variants.card === "string" ? variants.card.trim() : "";
	const detail = typeof variants.detail === "string" ? variants.detail.trim() : "";
	const full = typeof variants.full === "string" ? variants.full.trim() : "";
	if (!thumb || !card || !detail || !full) return null;

	const blurDataURL = typeof raw.blurDataURL === "string" ? raw.blurDataURL.trim() : "";
	const alt = typeof raw.alt === "string" ? raw.alt.trim() : "";
	const width = readFiniteDimension(raw.width);
	const height = readFiniteDimension(raw.height);
	if (!blurDataURL || !alt || width === null || height === null || width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
		return null;
	}

	return {
		variants: { thumb, card, detail, full },
		blurDataURL,
		width: Math.trunc(width),
		height: Math.trunc(height),
		alt,
	};
}

/**
 * Type guard to detect a `StoredImage` at runtime. Useful when deserialising
 * a `Setting.value` blob whose shape is `unknown` until we know its `key`.
 */
export function isStoredImage(value: unknown): value is StoredImage {
	return coerceStoredImage(value) !== null;
}
