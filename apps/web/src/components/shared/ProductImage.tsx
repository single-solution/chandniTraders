"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import type { StoredImage, StoredImageVariantKey } from "@store/shared";

import { ProductVisual } from "@/components/shared/ProductVisual";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { useGlobalEagerLoad } from "@/lib/useGlobalEagerLoad";

interface ProductImageProps {
	/** Multi-resolution image record. Optional so we can fall back to ProductVisual. */
	image?: StoredImage | null;
	/** Which pre-rendered variant to prefer for this surface. */
	variant?: StoredImageVariantKey;
	/** Display-friendly product name (for alt + fallback). */
	name: string;
	brandName: string;
	brandSlug: string;
	sizes?: string;
	priority?: boolean;
	/** Override the default per-variant quality. Defaults trade ~25% bytes for
	 *  imperceptible loss at the rendered size of each surface. */
	quality?: number;
	onLoadComplete?: () => void;
}

/**
 * Per-variant quality defaults. Card / thumb surfaces render small, so a
 * lower quality knob shaves meaningful bytes without visible loss; the
 * detail/full variants stay near max for PDP hero + lightbox.
 */
const QUALITY_BY_VARIANT: Record<StoredImageVariantKey, number> = {
	thumb: 65,
	card: 70,
	detail: 80,
	full: 85,
};

/**
 * Hero image for the storefront product card and PDP.
 *
 * Reads from a `StoredImage`. The caller picks the variant (`thumb`, `card`, `detail`, `full`).
 */
export function ProductImage({
	image,
	variant = "card",
	name,
	brandName,
	brandSlug,
	sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
	priority = false,
	quality = QUALITY_BY_VARIANT[variant],
	onLoadComplete,
}: ProductImageProps) {
	const [hasFailed, setHasFailed] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);
	const globalEager = useGlobalEagerLoad();
	// Logical OR (not `??`) so an empty-string variant (legacy seed data that
	// wrote `""` instead of dropping the key) still falls through to the next
	// best variant rather than producing `<Image src="">`. Without this the PDP
	// hero shows a blank well while the listing card (which asks for the `card`
	// variant directly) renders fine.
	const src = image?.variants[variant] || image?.variants.card || image?.variants.full || "";
	const showLoadFade = !priority;

	useEffect(() => {
		scheduleStateUpdate(() => {
			setHasFailed(false);
			if (showLoadFade) {
				setHasLoaded(false);
			}
		});
	}, [src, showLoadFade]);

	useEffect(() => {
		if (hasFailed || !image || !src) {
			onLoadComplete?.();
		}
	}, [hasFailed, image, src, onLoadComplete]);

	if (hasFailed || !image || !src) {
		return <ProductVisual brandName={brandName} modelName={name} colorName="" brandSlug={brandSlug} size="md" className="product-media-well" />;
	}

	const altText = image.alt || `${brandName} ${name}`;

	return (
		<div className="product-media-well relative size-full">
			<Image
				src={src}
				alt={altText}
				fill
				sizes={sizes}
				priority={priority}
				loading={priority ? "eager" : globalEager ? "eager" : "lazy"}
				quality={quality}
				placeholder={image.blurDataURL ? "blur" : undefined}
				blurDataURL={image.blurDataURL || undefined}
				data-img-fade={showLoadFade && !hasLoaded ? "false" : "true"}
				className="object-cover object-center"
				onLoad={() => {
					setHasLoaded(true);
					onLoadComplete?.();
				}}
				onError={() => {
					setHasFailed(true);
					onLoadComplete?.();
				}}
			/>
		</div>
	);
}
