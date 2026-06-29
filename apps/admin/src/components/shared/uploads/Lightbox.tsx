"use client";

/**
 * Admin image lightbox. Renders one image at a time from a list of
 * URLs with keyboard navigation (← / → / Esc) and click-outside close.
 *
 * Used by `<ImageGallery>` (multi-image fields) and the `<ImageUpload>`
 * preview popper.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface LightboxProps {
	/** Ordered list of full-resolution image URLs. */
	urls: string[];
	/** Index to open at. */
	initialIndex: number;
	alt?: string;
	onClose: () => void;
}

export function Lightbox({ urls, initialIndex, alt, onClose }: LightboxProps) {
	const [index, setIndex] = useState(initialIndex);
	const [isHydrated, setIsHydrated] = useState(false);
	const total = urls.length;

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsHydrated(true);
	}, []);

	const goPrev = useCallback(() => {
		setIndex((current) => (current - 1 + total) % total);
	}, [total]);
	const goNext = useCallback(() => {
		setIndex((current) => (current + 1) % total);
	}, [total]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
			else if (e.key === "ArrowLeft") goPrev();
			else if (e.key === "ArrowRight") goNext();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [goNext, goPrev, onClose]);

	if (total === 0 || !isHydrated) return null;
	const url = urls[Math.max(0, Math.min(index, total - 1))];

	const lightboxElement = (
		<div className="animate-sheet-fade fixed inset-0 z-[200] flex items-center justify-center bg-[var(--color-ink-900)]/80 p-6" onClick={onClose} role="dialog" aria-modal="true">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute right-4 top-4 rounded-full bg-[var(--color-canvas)]/10 p-2 text-[var(--color-canvas)] hover:bg-[var(--color-canvas)]/20"
			>
				<X size={16} />
			</button>
			{total > 1 && (
				<button
					type="button"
					aria-label="Previous image"
					onClick={(e) => {
						e.stopPropagation();
						goPrev();
					}}
					className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-[var(--color-canvas)]/10 p-2 text-[var(--color-canvas)] hover:bg-[var(--color-canvas)]/20"
				>
					<ChevronLeft size={20} />
				</button>
			)}
			{total > 1 && (
				<button
					type="button"
					aria-label="Next image"
					onClick={(e) => {
						e.stopPropagation();
						goNext();
					}}
					className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-[var(--color-canvas)]/10 p-2 text-[var(--color-canvas)] hover:bg-[var(--color-canvas)]/20"
				>
					<ChevronRight size={20} />
				</button>
			)}
			{/* eslint-disable-next-line @next/next/no-img-element -- lightbox renders the unmodified `full` variant URL at its native aspect; next/image would force fixed width/height props that the gallery's free-aspect viewport cannot supply. */}
			<img
				src={url}
				alt={alt ?? `Image ${index + 1} of ${total}`}
				className="animate-lightbox-in max-h-full max-w-full rounded-lg shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			/>
		</div>
	);

	return createPortal(lightboxElement, document.body);
}
