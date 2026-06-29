"use client";

/**
 * Admin-side mirror of the storefront `StructuredContentFull` renderer.
 * Lives here so admin previews use the exact same DOM/typography/icon
 * conventions as the storefront without crossing the app boundary.
 * Keep the class lists and prop surface in sync with
 * `apps/web/src/components/shared/StructuredContent.tsx` so previews
 * remain faithful.
 */

import type { CSSProperties } from "react";
import { STRUCTURED_CONTENT_DEFAULT_BULLET_ICON, type StructuredContent } from "@store/shared";

import { LucideIconRenderer } from "@/components/icons/LucideIconRenderer";

interface FullProps {
	content?: StructuredContent;
	fallback?: string;
	className?: string;
	maxBullets?: number;
	fallbackIcon?: string;
	iconSizeClass?: string;
	iconSize?: number;
	iconColor?: string;
	bulletItemClassName?: string;
}

interface CompactProps {
	content?: StructuredContent;
	fallback?: string;
	className?: string;
	clampLines?: 1 | 2 | 3 | 4 | 5;
}

const CLAMP_CLASS: Record<NonNullable<CompactProps["clampLines"]>, string> = {
	1: "line-clamp-1",
	2: "line-clamp-2",
	3: "line-clamp-3",
	4: "line-clamp-4",
	5: "line-clamp-5",
};

function resolveSummary(content?: StructuredContent, fallback?: string): string {
	if (content && content.summary) {
		return content.summary;
	}
	return fallback?.trim() ?? "";
}

function resolveBullets(content?: StructuredContent) {
	if (!content || !Array.isArray(content.bullets)) return [];
	return content.bullets.filter((bullet) => bullet.text.trim().length > 0);
}

export function StructuredContentCompactPreview({ content, fallback, className, clampLines }: CompactProps) {
	const summary = resolveSummary(content, fallback);
	if (!summary) return null;
	const classes = [className, clampLines ? CLAMP_CLASS[clampLines] : null].filter(Boolean).join(" ");
	return <p className={classes || undefined}>{summary}</p>;
}

export function StructuredContentFullPreview({
	content,
	fallback,
	className,
	maxBullets,
	fallbackIcon = STRUCTURED_CONTENT_DEFAULT_BULLET_ICON,
	iconSizeClass = "size-3",
	iconSize = 11,
	iconColor,
	bulletItemClassName,
}: FullProps) {
	const summary = resolveSummary(content, fallback);
	const bullets = resolveBullets(content);
	if (!summary && bullets.length === 0) return null;
	const visibleBullets = typeof maxBullets === "number" && maxBullets >= 0 ? bullets.slice(0, maxBullets) : bullets;
	const iconStyle: CSSProperties | undefined = iconColor ? { color: iconColor } : undefined;
	return (
		<div className={className || undefined}>
			{summary && <p className="leading-snug">{summary}</p>}
			{visibleBullets.length > 0 && (
				<ul className={summary ? "mt-3 space-y-1" : "space-y-1"}>
					{visibleBullets.map((bullet, index) => (
						<li key={`${bullet.text}-${index}`} className={"flex items-center gap-1.5 " + (bulletItemClassName ?? "text-[12.5px] text-[var(--color-ink-700)]")}>
							<LucideIconRenderer name={bullet.icon || fallbackIcon} size={iconSize} strokeWidth={2} className={`${iconSizeClass} shrink-0`} style={iconStyle} aria-hidden />
							<span className="min-w-0 flex-1">{bullet.text}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
