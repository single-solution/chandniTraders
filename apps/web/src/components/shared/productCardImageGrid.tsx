"use client";

import { ProductImage } from "@/components/shared/ProductImage";
import type { StoredImage } from "@store/shared";

const GRID_IMAGE_SIZES = "(max-width: 640px) 25vw, 12vw";

interface ProductCardImageGridProps {
	images: StoredImage[];
	name: string;
	brandName: string;
	brandSlug: string;
	priority?: boolean;
}

/** Static 2×2 product gallery — four images visible at once, no cycling. */
export function ProductCardImageGrid({ images, name, brandName, brandSlug, priority = false }: ProductCardImageGridProps) {
	if (images.length === 0) {
		return (
			<div className="absolute inset-0">
				<ProductImage image={undefined} variant="card" name={name} brandName={brandName} brandSlug={brandSlug} priority={priority} />
			</div>
		);
	}

	if (images.length === 1) {
		return (
			<div className="absolute inset-0">
				<ProductImage
					image={images[0]}
					variant="card"
					name={name}
					brandName={brandName}
					brandSlug={brandSlug}
					priority={priority}
				/>
			</div>
		);
	}

	return (
		<div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-[var(--color-ink-100)]">
			{images.map((image, index) => (
				<div key={`${image.variants.card}-${index}`} className="relative min-h-0 min-w-0 overflow-hidden bg-[var(--color-canvas-deep)]">
					<ProductImage
						image={image}
						variant="card"
						name={name}
						brandName={brandName}
						brandSlug={brandSlug}
						priority={priority && index === 0}
						sizes={GRID_IMAGE_SIZES}
					/>
				</div>
			))}
		</div>
	);
}
