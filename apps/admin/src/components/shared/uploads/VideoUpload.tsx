"use client";

/**
 * Single-video input. Used for `Grade.video`. The stored URL is either
 * an uploaded mp4/webm hosted by us OR a YouTube link — both fit the
 * same single-string field. The storefront renders an `<iframe>` for
 * YouTube and a `<video>` for everything else.
 *
 * Persistence contract: parent owns the URL string. Uploads POST to
 * `/api/uploads?kind=video`; YouTube links are stored verbatim (we
 * never call removeStoredUrls on a YouTube URL — there's nothing to
 * delete in object storage).
 */

import { useId, useRef, useState } from "react";
import { Film, Link2, Play, RefreshCcw, Trash2 } from "lucide-react";

import { parseYouTubeId, toYouTubeEmbedUrl } from "@store/shared";

import { removeStoredUrls, uploadVideo } from "./uploadClient";

interface VideoUploadProps {
	value: string;
	onChange: (url: string) => void;
	subjectKind?: string;
	subjectId?: string;
	label?: string;
	hint?: string;
}

export function VideoUpload({ value, onChange, subjectKind, subjectId, label, hint }: VideoUploadProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [linkDraft, setLinkDraft] = useState("");

	const youtubeEmbedUrl = toYouTubeEmbedUrl(value);
	const isYouTube = youtubeEmbedUrl !== null;

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		setError(null);
		setBusy(true);
		try {
			const result = await uploadVideo({ file, subjectKind, subjectId });
			// Only the uploaded variant is something we own and must clean up;
			// YouTube links live on YouTube.
			if (value && !isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange(result.url);
			setLinkDraft("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function handleRemove() {
		if (!value) return;
		setBusy(true);
		try {
			if (!isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange("");
			setLinkDraft("");
		} finally {
			setBusy(false);
		}
	}

	async function handleAttachLink() {
		const trimmed = linkDraft.trim();
		if (!trimmed) return;
		if (!parseYouTubeId(trimmed)) {
			setError("That doesn't look like a YouTube URL.");
			return;
		}
		setError(null);
		setBusy(true);
		try {
			if (value && !isYouTube) {
				await removeStoredUrls([value]);
			}
			onChange(trimmed);
			setLinkDraft("");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			{Boolean(label) && (
				<label htmlFor={inputId} className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-700)]">
					{label}
				</label>
			)}
			<input ref={inputRef} id={inputId} type="file" accept="video/mp4,video/webm" className="sr-only" disabled={busy} onChange={(e) => handleFiles(e.target.files)} />
			{value ? (
				<div className="rounded-lg border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
					{isYouTube ? (
						<div className="aspect-video w-full overflow-hidden rounded-md bg-black">
							<iframe
								src={youtubeEmbedUrl ?? undefined}
								title="YouTube inspection video"
								loading="lazy"
								referrerPolicy="strict-origin-when-cross-origin"
								allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowFullScreen
								className="size-full"
							/>
						</div>
					) : (
						<video src={value} controls playsInline preload="metadata" className="w-full rounded-md bg-black" />
					)}
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => inputRef.current?.click()}
							disabled={busy}
							className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)] disabled:opacity-60"
						>
							<RefreshCcw size={12} /> Replace with upload
						</button>
						<button
							type="button"
							onClick={handleRemove}
							disabled={busy}
							className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rose-200)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-rose-700)] hover:bg-[var(--color-rose-50)] disabled:opacity-60"
						>
							<Trash2 size={12} /> Remove
						</button>
						<span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--color-ink-500)]">
							{isYouTube ? (
								<>
									<Play size={12} /> YouTube link
								</>
							) : (
								<>
									<Film size={12} /> Uploaded file
								</>
							)}
						</span>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						disabled={busy}
						className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] p-6 text-[var(--color-ink-500)] hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
					>
						<Film size={20} />
						<span className="text-[12.5px] font-semibold">{busy ? "Uploading…" : "Upload video"}</span>
						{Boolean(hint) && <span className="text-[11px]">{hint}</span>}
					</button>
					<div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-400)]">
						<span className="h-px flex-1 bg-[var(--color-ink-100)]" />
						or paste a YouTube link
						<span className="h-px flex-1 bg-[var(--color-ink-100)]" />
					</div>
					<div className="flex items-center gap-2">
						<span className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-500)]">
							<Link2 size={14} />
						</span>
						<input
							type="url"
							value={linkDraft}
							onChange={(e) => {
								setLinkDraft(e.target.value);
								if (error) setError(null);
							}}
							placeholder="https://youtube.com/watch?v=…"
							disabled={busy}
							autoComplete="off"
							spellCheck={false}
							className="block w-full min-w-0 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[13px] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none disabled:opacity-60"
						/>
						<button
							type="button"
							onClick={handleAttachLink}
							disabled={busy || !linkDraft.trim()}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)] disabled:opacity-50"
						>
							<Play size={13} /> Use link
						</button>
					</div>
				</div>
			)}
			{Boolean(error) && (
				<p className="text-[12px] text-[var(--color-rose-700)]" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
