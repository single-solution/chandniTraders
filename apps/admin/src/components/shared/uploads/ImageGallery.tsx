"use client";

/**
 * Multi-image ordered gallery. Used for `Product.images[]` and inquiry
 * chat attachments. The first image is the hero. Drag to
 * reorder, click the `x` to remove, click a thumb body to open the
 * full-resolution lightbox.
 */

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";

import { ImageGalleryThumb } from "./ImageGalleryThumb";
import { Lightbox } from "./Lightbox";
import { createPendingGalleryImage, getGalleryImageKey, getGalleryImageUrl, isPendingGalleryImage, type GalleryImage } from "./imageStaging";

interface ImageGalleryProps {
	value: GalleryImage[];
	onChange: (images: GalleryImage[]) => void;
	/** Base alt text. The gallery appends ` · image <N>` per file. */
	altTextBase?: string;
	/** Optional cap on the number of images. */
	maxImages?: number;
	/** Optional label rendered above the grid. */
	label?: string;
	/** Smaller tiles; click zoom still opens the lightbox. */
	compact?: boolean;
	/** Extra-small tiles for tight drawers (use with `compact`). */
	dense?: boolean;
}

const DEFAULT_MAX = 8;

export function ImageGallery({ value, onChange, altTextBase, maxImages = DEFAULT_MAX, label, compact = false, dense = false }: ImageGalleryProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const dragIndex = useRef<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	const remainingSlots = Math.max(0, maxImages - value.length);

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setError(null);
		const accepted = Array.from(files).slice(0, remainingSlots);
		try {
			const additions: GalleryImage[] = [];
			for (let i = 0; i < accepted.length; i++) {
				const file = accepted[i];
				const altIndex = value.length + i + 1;
				const imageAltText = altTextBase ? `${altTextBase} · image ${altIndex}` : undefined;
				try {
					const pending = await createPendingGalleryImage(file, imageAltText ?? file.name.replace(/\.[^.]+$/, ""));
					additions.push(pending);
				} catch (uploadError) {
					setError(uploadError instanceof Error ? `Failed to preview "${file.name}": ${uploadError.message}` : `Failed to preview "${file.name}"`);
				}
			}
			if (additions.length > 0) onChange([...value, ...additions]);
		} finally {
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	function handleRemove(index: number) {
		const removed = value[index];
		if (!removed) return;
		const next = value.slice(0, index).concat(value.slice(index + 1));
		onChange(next);
	}

	function handleAltChange(index: number, alt: string) {
		const next = value.map((image, i) => (i === index ? { ...image, alt } : image));
		onChange(next);
	}

	function handleDragStart(index: number) {
		dragIndex.current = index;
	}
	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
	}
	function handleDrop(targetIndex: number) {
		const source = dragIndex.current;
		dragIndex.current = null;
		if (source === null || source === targetIndex) return;
		const next = value.slice();
		const [moved] = next.splice(source, 1);
		next.splice(targetIndex, 0, moved);
		onChange(next);
	}

	return (
		<div className="flex flex-col gap-2">
			{Boolean(label) && (
				<label htmlFor={inputId} className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
					{label}
				</label>
			)}
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				className="sr-only"
				disabled={remainingSlots === 0}
				onChange={(e) => handleFiles(e.target.files)}
			/>
			<div
				className={compact ? (dense ? "flex flex-wrap gap-1.5" : "grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6") : "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"}
			>
				{value.map((image, index) => (
					<ImageGalleryThumb
						key={getGalleryImageKey(image)}
						image={image}
						index={index}
						isHero={index === 0}
						compact={compact}
						dense={dense}
						onAltChange={(alt) => handleAltChange(index, alt)}
						onRemove={() => handleRemove(index)}
						onPreview={() => setLightboxIndex(index)}
						onDragStart={() => handleDragStart(index)}
						onDragOver={handleDragOver}
						onDrop={() => handleDrop(index)}
					/>
				))}
				{remainingSlots > 0 && (
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						className={
							compact && dense
								? "flex size-24 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-500)] transition hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
								: "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] p-2 text-[var(--color-ink-500)] transition hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
						}
					>
						<ImagePlus size={dense ? 18 : compact ? 16 : 20} />
						<span className={dense ? "sr-only" : compact ? "text-[10px] font-semibold" : "text-[11.5px] font-semibold"}>Add</span>
						{!compact && (
							<span className="text-[10.5px]">
								{value.length}/{maxImages}
							</span>
						)}
					</button>
				)}
			</div>
			{Boolean(error) && (
				<p className="text-[12px] text-[var(--color-rose-700)]" role="alert">
					{error}
				</p>
			)}
			{lightboxIndex !== null && (
				<Lightbox
					urls={value.map((image) => getGalleryImageUrl(image, "full"))}
					initialIndex={lightboxIndex}
					alt={value[lightboxIndex]?.alt}
					onClose={() => setLightboxIndex(null)}
				/>
			)}
		</div>
	);
}
