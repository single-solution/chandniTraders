"use client";

import type { ResolvedSeoMeta } from "@store/shared";
import Image from "next/image";

const TITLE_MAX = 70;
const DESC_MAX = 150;

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}…`;
}

interface SocialPreviewProps {
	resolved: ResolvedSeoMeta;
	siteUrl: string;
}

export function SocialPreview({ resolved, siteUrl }: SocialPreviewProps) {
	const title = truncate(resolved.title, TITLE_MAX);
	const description = truncate(resolved.description, DESC_MAX);
	const domain = new URL(siteUrl).hostname.replace(/^www\./, "");

	return (
		<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-white p-4" aria-label="Social share preview">
			<p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-500)] mb-3">Social share preview</p>
			<div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[#f8f9fa] shadow-sm">
				{resolved.ogImageUrl ? (
					<div className="relative aspect-[1.91/1] w-full border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]">
						<Image src={resolved.ogImageUrl} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" unoptimized />
					</div>
				) : (
					<div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-400)]">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
						<span className="text-xs font-medium">No image</span>
					</div>
				)}
				<div className="p-3">
					<p className="mb-0.5 truncate text-[11px] font-medium uppercase text-[var(--color-ink-500)]">{domain}</p>
					<p className="mb-1 truncate text-sm font-semibold text-[var(--color-ink-900)]">{title}</p>
					<p className="line-clamp-2 text-xs text-[var(--color-ink-600)]">{description}</p>
				</div>
			</div>
		</div>
	);
}
