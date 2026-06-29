"use client";

/**
 * Single-file brand image input — used by the Settings → Branding tab
 * for the four brand assets (logo light/dark + favicon light/dark).
 *
 * Persistence contract: the parent owns one URL string per asset. We
 * POST to `/api/uploads?kind=image` (the existing image pipeline) to
 * receive a fully-processed `StoredImage` and write the `full`
 * variant's URL back through `onChange`. Empty string = "no asset
 * uploaded" — the storefront falls back to the text-only wordmark.
 *
 * Why not the full `ImageUpload` gallery? Brand assets are singletons,
 * so a gallery surface would be misleading. This component is a tight
 * preview + Replace + Remove tile that fits inside the FormGrid two-up
 * layout in `Settings.tsx`.
 */

import { useId, useRef, useState } from "react";
import { Image as ImageIcon, RefreshCcw, Trash2 } from "lucide-react";

import { removeStoredUrls, uploadImage } from "./uploadClient";

interface BrandImageUploadProps {
	/** Current URL stored on the setting. Empty string ⇒ nothing uploaded. */
	value: string;
	/** Called whenever the URL changes (upload, replace, or remove). */
	onChange: (url: string) => void;
	/** Visible label, e.g. "Logo (light)". */
	label: string;
	/** Optional helper line under the input. */
	hint?: string;
	/** Used by the upload pipeline to slot files under a per-subject path. */
	subjectKind?: string;
	/** Tone of the preview tile background — light tile for "for light surfaces"
	 *  assets, dark tile for "for dark surfaces" assets so the admin can verify
	 *  the contrast against the surface the asset will actually sit on. */
	previewTone?: "light" | "dark";
	disabled?: boolean;
}

export function BrandImageUpload({ value, onChange, label, hint, subjectKind = "brand", previewTone = "light", disabled = false }: BrandImageUploadProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		setError(null);
		setBusy(true);
		try {
			const stored = await uploadImage({
				file,
				subjectKind,
				altTextBase: label,
			});
			/* Best-effort cleanup of the previously stored variants so we don't
         keep orphan blobs around when the admin replaces an asset. We
         await before swapping so a failed cleanup never leaves the
         setting pointing at a half-deleted URL. */
			if (value) {
				await removeStoredUrls([value]);
			}
			onChange(stored.variants.full);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function handleRemove() {
		if (!value || busy) return;
		setBusy(true);
		try {
			/* Settings only persists the `full` variant URL, so we can't
         reconstruct the rest of the variant ladder. Sending the single
         URL through `removeStoredUrls` is still a correct best-effort
         delete — the storage provider treats unknown URLs as no-ops. */
			await removeStoredUrls([value]);
			onChange("");
		} finally {
			setBusy(false);
		}
	}

	const previewBgClass = previewTone === "dark" ? "bg-[var(--color-ink-900)]" : "bg-[var(--color-canvas)]";

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={inputId} className="text-[12px] font-semibold text-[var(--color-ink-800)]">
				{label}
			</label>
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="sr-only"
				disabled={busy || disabled}
				onChange={(event) => handleFiles(event.target.files)}
			/>
			{value ? (
				<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-2">
					<div className={`grid h-20 place-items-center rounded-[var(--radius-sm)] ${previewBgClass}`}>
						{/* Brand assets are user-uploaded marks; using a plain <img>
                keeps this component framework-agnostic (next/image needs
                an explicit width/height we don't know up front and a
                domain allowlist for remote storage). */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={value} alt={label} className="max-h-16 max-w-[80%] object-contain" />
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<button
							type="button"
							onClick={() => inputRef.current?.click()}
							disabled={busy || disabled}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-ink-800)] transition-colors hover:bg-[var(--color-canvas-deep)] disabled:opacity-60"
						>
							<RefreshCcw size={11} /> Replace
						</button>
						<button
							type="button"
							onClick={handleRemove}
							disabled={busy || disabled}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-danger-200)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-danger-700)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-60"
						>
							<Trash2 size={11} /> Remove
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={busy || disabled}
					className="flex w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] p-4 text-[var(--color-ink-500)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-700)] disabled:opacity-60"
				>
					<ImageIcon size={18} />
					<span className="text-[12px] font-semibold">{busy ? "Uploading…" : "Upload"}</span>
				</button>
			)}
			{hint ? <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p> : null}
			{error ? (
				<p className="text-[11px] text-[var(--color-danger-700)]" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
