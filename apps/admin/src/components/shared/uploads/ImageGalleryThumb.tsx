"use client";

/**
 * One thumbnail tile inside `<ImageGallery>`. Owns the drag handle,
 * the alt-text inline editor, the hero badge, and the remove button.
 */

import { useId, useState } from "react";
import Image from "next/image";
import { Star, Trash2, ZoomIn } from "lucide-react";

import { getGalleryImageUrl, isPendingGalleryImage, type GalleryImage } from "./imageStaging";

interface ImageGalleryThumbProps {
	image: GalleryImage;
	index: number;
	isHero: boolean;
	compact?: boolean;
	dense?: boolean;
	onAltChange: (alt: string) => void;
	onRemove: () => void;
	onPreview: () => void;
	onDragStart: () => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: () => void;
}

export function ImageGalleryThumb({
	image,
	index,
	isHero,
	compact = false,
	dense = false,
	onAltChange,
	onRemove,
	onPreview,
	onDragStart,
	onDragOver,
	onDrop,
}: ImageGalleryThumbProps) {
	const altInputId = useId();
	const [altDraft, setAltDraft] = useState(image.alt);
	const thumbUrl = getGalleryImageUrl(image, "thumb");

	function commitAlt() {
		if (altDraft !== image.alt) onAltChange(altDraft);
	}

	return (
		<div
			draggable
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			className={
				dense
					? "group relative shrink-0 rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-0.5"
					: compact
						? "group relative flex flex-col gap-1 rounded-md border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-1"
						: "group relative flex flex-col gap-1.5 rounded-lg border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2"
			}
		>
			<div className="relative">
				<button
					type="button"
					aria-label={`Preview image ${index + 1}`}
					onClick={onPreview}
					className={
						dense
							? "relative block size-24 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-canvas-deep)]"
							: "relative block aspect-square w-full overflow-hidden rounded-md bg-[var(--color-canvas-deep)]"
					}
				>
					{isPendingGalleryImage(image) ? (
						// eslint-disable-next-line @next/next/no-img-element -- local object URL preview before final upload
						<img src={thumbUrl} alt={image.alt || `Image ${index + 1}`} className="size-full object-cover" />
					) : (
						<Image
							src={thumbUrl}
							alt={image.alt || `Image ${index + 1}`}
							width={image.width}
							height={image.height}
							placeholder={image.blurDataURL ? "blur" : "empty"}
							blurDataURL={image.blurDataURL || undefined}
							className="size-full object-cover"
						/>
					)}
					{isPendingGalleryImage(image) && (
						<span
							className={
								compact || dense
									? "absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 py-px text-[8px] font-semibold text-white"
									: "absolute left-1.5 bottom-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white"
							}
						>
							{compact || dense ? "…" : "On save"}
						</span>
					)}
					{isHero && (
						<span
							className={
								compact || dense
									? "absolute left-0.5 top-0.5 rounded bg-[var(--color-accent-500)] px-1 py-px text-[8px] font-bold text-[var(--color-ink-900)]"
									: "absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-500)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink-900)]"
							}
						>
							{compact || dense ? (
								"★"
							) : (
								<>
									<Star size={10} /> Hero
								</>
							)}
						</span>
					)}
					{!compact && (
						<span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/40 p-1 text-white opacity-0 transition group-hover:opacity-100">
							<ZoomIn size={12} />
						</span>
					)}
				</button>
				<button
					type="button"
					aria-label="Remove"
					onClick={(event) => {
						event.stopPropagation();
						onRemove();
					}}
					className={
						compact || dense
							? "absolute right-0.5 top-0.5 z-10 rounded-full bg-[var(--color-rose-700)]/90 p-0.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-rose-700)]"
							: "absolute right-1.5 bottom-1.5 z-10 rounded-full bg-[var(--color-rose-700)]/85 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-rose-700)]"
					}
				>
					<Trash2 size={compact || dense ? 10 : 12} />
				</button>
			</div>
			{!dense && (
				<>
					<label htmlFor={altInputId} className="sr-only">
						Alt text for image {index + 1}
					</label>
					<input
						id={altInputId}
						type="text"
						value={altDraft}
						onChange={(e) => setAltDraft(e.target.value)}
						onBlur={commitAlt}
						placeholder="Alt text"
						className={
							compact
								? "w-full rounded border border-transparent bg-transparent px-0.5 py-0 text-[10px] text-[var(--color-ink-800)] focus:border-[var(--color-accent-500)] focus:bg-[var(--color-surface)] focus:outline-none"
								: "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[11.5px] text-[var(--color-ink-800)] focus:border-[var(--color-accent-500)] focus:bg-[var(--color-surface)] focus:outline-none"
						}
					/>
				</>
			)}
		</div>
	);
}
