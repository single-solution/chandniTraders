"use client";

/**
 * Single-media uploader for hero banners.
 *
 * Enforces strictly 1 asset (1 image OR 1 video) active at a time.
 * Supports:
 *   - Uploading an image (JPEG, PNG, WebP)
 *   - Uploading a video (MP4, WebM)
 *   - Pasting a YouTube link
 *
 * Persistence contract:
 *   - Calls `onChange` with `{ url, type, alt }`
 *   - Performs best-effort cleanup of previously uploaded storage blobs
 *     via `removeStoredUrls` when replacing or removing.
 */

import { useId, useRef, useState } from "react";
import { Film, Image as ImageIcon, Link2, Loader2, Play, RefreshCcw, Trash2 } from "lucide-react";

import { parseYouTubeId, toYouTubeEmbedUrl } from "@store/shared";

import { removeStoredUrls, uploadImage, uploadVideo } from "./uploadClient";

export interface SingleMediaValue {
	url: string;
	type: "image" | "video" | "none";
	alt?: string;
}

interface SingleMediaUploadProps {
	value: string;
	mediaType: "image" | "video" | "none";
	alt?: string;
	onChange: (media: { url: string; type: "image" | "video" | "none"; alt?: string }) => void;
	label?: string;
	hint?: string;
	subjectKind?: string;
	disabled?: boolean;
}

export function SingleMediaUpload({
	value,
	mediaType,
	alt = "",
	onChange,
	label = "Home banner media",
	hint = "Upload 1 image or 1 video (or YouTube link) for the storefront home banner.",
	subjectKind = "hero-banner",
	disabled = false,
}: SingleMediaUploadProps) {
	const imageInputId = useId();
	const videoInputId = useId();
	const altInputId = useId();
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const videoInputRef = useRef<HTMLInputElement | null>(null);

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [linkDraft, setLinkDraft] = useState("");
	const [altDraft, setAltDraft] = useState(alt);

	// Derive actual media type if not explicitly set but URL exists
	const youtubeEmbedUrl = toYouTubeEmbedUrl(value);
	const isYouTube = youtubeEmbedUrl !== null;
	const isVideo = mediaType === "video" || isYouTube || /\.(mp4|webm)$/i.test(value);
	const isImage = value ? !isVideo : false;

	async function handleImageFile(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		setError(null);
		setBusy(true);
		try {
			const stored = await uploadImage({
				file,
				subjectKind,
				altTextBase: altDraft || "Home banner",
			});
			if (value && !isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange({
				url: stored.variants.full,
				type: "image",
				alt: altDraft,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Image upload failed");
		} finally {
			setBusy(false);
			if (imageInputRef.current) imageInputRef.current.value = "";
		}
	}

	async function handleVideoFile(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		setError(null);
		setBusy(true);
		try {
			const result = await uploadVideo({
				file,
				subjectKind,
			});
			if (value && !isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange({
				url: result.url,
				type: "video",
				alt: altDraft,
			});
			setLinkDraft("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Video upload failed");
		} finally {
			setBusy(false);
			if (videoInputRef.current) videoInputRef.current.value = "";
		}
	}

	async function handleAttachLink() {
		const trimmed = linkDraft.trim();
		if (!trimmed) return;
		const isYt = Boolean(parseYouTubeId(trimmed));
		const isDirectVideo = /\.(mp4|webm)(\?.*)?$/i.test(trimmed);
		const isHttpUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");

		if (!isYt && !isHttpUrl) {
			setError("Please enter a valid URL (e.g. https://... or a YouTube link).");
			return;
		}

		setError(null);
		setBusy(true);
		try {
			if (value && !isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange({
				url: trimmed,
				type: "video",
				alt: altDraft,
			});
			setLinkDraft("");
		} finally {
			setBusy(false);
		}
	}

	async function handleRemove() {
		if (!value || busy) return;
		setBusy(true);
		try {
			if (!isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange({
				url: "",
				type: "none",
				alt: "",
			});
			setLinkDraft("");
			setAltDraft("");
		} finally {
			setBusy(false);
		}
	}

	function handleAltBlur() {
		if (value) {
			onChange({
				url: value,
				type: isVideo ? "video" : "image",
				alt: altDraft,
			});
		}
	}

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<label className="text-[12px] font-semibold text-[var(--color-ink-800)]">{label}</label>
				{value ? (
					<span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-600)]">
						{isYouTube ? "YouTube Video" : isVideo ? "Uploaded Video" : "Image"}
					</span>
				) : null}
			</div>

			<input
				ref={imageInputRef}
				id={imageInputId}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="sr-only"
				disabled={busy || disabled}
				onChange={(e) => handleImageFile(e.target.files)}
			/>
			<input
				ref={videoInputRef}
				id={videoInputId}
				type="file"
				accept="video/mp4,video/webm"
				className="sr-only"
				disabled={busy || disabled}
				onChange={(e) => handleVideoFile(e.target.files)}
			/>

			{value ? (
				<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
					{/* Active Preview */}
					<div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-ink-900)]">
						{isVideo ? (
							isYouTube ? (
								<iframe
									src={youtubeEmbedUrl ?? undefined}
									title="Banner YouTube Video"
									loading="lazy"
									referrerPolicy="strict-origin-when-cross-origin"
									allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
									className="size-full"
								/>
							) : (
								<video src={value} controls playsInline preload="metadata" className="size-full object-contain" />
							)
						) : (
							/* eslint-disable-next-line @next/next/no-img-element */
							<img src={value} alt={altDraft || "Banner preview"} className="size-full object-cover" />
						)}
					</div>

					{/* Caption / Badge text input */}
					<div className="mt-3 flex flex-col gap-1">
						<label htmlFor={altInputId} className="text-[11px] font-medium text-[var(--color-ink-600)]">
							Banner caption badge (optional)
						</label>
						<input
							id={altInputId}
							type="text"
							value={altDraft}
							onChange={(e) => setAltDraft(e.target.value)}
							onBlur={handleAltBlur}
							placeholder="e.g. Featured Collection, Coolers & Washers"
							disabled={busy || disabled}
							className="rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none disabled:opacity-60"
						/>
					</div>

					{/* Action Buttons */}
					<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-ink-100)] pt-3">
						<button
							type="button"
							onClick={() => imageInputRef.current?.click()}
							disabled={busy || disabled}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-ink-800)] transition-colors hover:bg-[var(--color-canvas-deep)] disabled:opacity-60"
						>
							<ImageIcon size={12} /> Replace with Image
						</button>
						<button
							type="button"
							onClick={() => videoInputRef.current?.click()}
							disabled={busy || disabled}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-ink-800)] transition-colors hover:bg-[var(--color-canvas-deep)] disabled:opacity-60"
						>
							<Film size={12} /> Replace with Video
						</button>
						<button
							type="button"
							onClick={handleRemove}
							disabled={busy || disabled}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-danger-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-danger-700)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-60"
						>
							<Trash2 size={12} /> Remove
						</button>
						{busy && (
							<span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-500)]">
								<Loader2 size={12} className="animate-spin" /> Processing…
							</span>
						)}
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
					<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						{/* Option 1: Upload Image */}
						<button
							type="button"
							onClick={() => imageInputRef.current?.click()}
							disabled={busy || disabled}
							className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] p-5 text-[var(--color-ink-600)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
						>
							<ImageIcon size={22} />
							<span className="text-[12px] font-semibold">Upload Image</span>
							<span className="text-[10.5px] text-[var(--color-ink-400)]">PNG, JPG, WebP</span>
						</button>

						{/* Option 2: Upload Video */}
						<button
							type="button"
							onClick={() => videoInputRef.current?.click()}
							disabled={busy || disabled}
							className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] p-5 text-[var(--color-ink-600)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
						>
							<Film size={22} />
							<span className="text-[12px] font-semibold">Upload Video</span>
							<span className="text-[10.5px] text-[var(--color-ink-400)]">MP4, WebM (up to 100MB)</span>
						</button>
					</div>

					{/* Option 3: YouTube Link */}
					<div className="flex items-center gap-2 pt-1">
						<span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-500)]">
							<Link2 size={14} />
						</span>
						<input
							type="url"
							value={linkDraft}
							onChange={(e) => {
								setLinkDraft(e.target.value);
								if (error) setError(null);
							}}
							placeholder="Or paste video/CDN/YouTube link (https://...)"
							disabled={busy || disabled}
							autoComplete="off"
							spellCheck={false}
							className="block w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none disabled:opacity-60"
						/>
						<button
							type="button"
							onClick={handleAttachLink}
							disabled={busy || disabled || !linkDraft.trim()}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)] disabled:opacity-50"
						>
							<Play size={12} /> Use link
						</button>
					</div>

					{busy && (
						<div className="flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-[var(--color-accent-700)]">
							<Loader2 size={14} className="animate-spin" /> Uploading…
						</div>
					)}
				</div>
			)}

			{hint ? <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p> : null}
			{error ? (
				<p className="text-[11.5px] font-medium text-[var(--color-danger-700)]" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
