/**
 * Storefront renderers for the admin-authored `StructuredContent`
 * payload (summary + icon-tagged bullets) shared by Category, Offer, and
 * Grade.
 *
 * Two variants:
 *   - `StructuredContentCompact`: short paragraph only, optional clamp.
 *     Used in dense surfaces (shop selectors, cards with hard size
 *     constraints) where we want copy without a bullet list.
 *   - `StructuredContentFull`: paragraph plus the bullet rows with their
 *     authored lucide icons. Used in roomy surfaces (homepage category
 *     cards, category landing headers, PDP grade showcase).
 *
 * Both variants are pure presentation. They never fetch; the caller
 * resolves the payload (via the storefront serializers) and passes it
 * in. Each variant accepts a `fallback` so callers can pass the legacy
 * `description`/`notes` string when no structured content exists.
 *
 * Surface-design guarantees:
 *   - The renderer never assumes a wrapper background — colors come from
 *     the surrounding card. We use CSS variables and `currentColor` so
 *     the bullet icon inherits the surface tone.
 *   - Missing/invalid bullet icons fall back to a surface-supplied
 *     default (or `DEFAULT_ICON`) so a card never collapses into a bare
 *     dot.
 *   - Bullet count is *not* clamped here — surfaces that need an equal
 *     height (e.g. homepage cards) pass `maxBullets` per breakpoint.
 */

import type { CSSProperties } from "react";
import { hasStructuredContent, type StructuredContent } from "@store/shared";

import { Icon } from "@/components/shared/Icon";

interface BaseProps {
	/** Resolved structured payload (already serializer-normalized). */
	content?: StructuredContent;
	/** Legacy summary fallback if `content` is missing or empty. */
	fallback?: string;
	/** Extra Tailwind classes applied to the outermost paragraph/list wrapper. */
	className?: string;
}

interface CompactProps extends BaseProps {
	/** Optional `line-clamp-N` value. Pass `0` or omit to disable clamping. */
	clampLines?: 1 | 2 | 3 | 4 | 5;
}

interface FullProps extends BaseProps {
	/** Cap on bullet rows; surfaces that need equal-height clamp per breakpoint. */
	maxBullets?: number;
	/** Tailwind size class applied to bullet icons (defaults to size-3). */
	iconSizeClass?: string;
	/** Numeric icon size for `lucide-react` (matches `iconSizeClass` visually). */
	iconSize?: number;
	/** Tone applied to bullet icons (CSS color value, supports CSS variables). */
	iconColor?: string;
	/** Optional class applied to each `<li>` (typography, spacing). */
	bulletItemClassName?: string;
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

export function StructuredContentCompact({ content, fallback, className, clampLines }: CompactProps) {
	const summary = resolveSummary(content, fallback);
	if (!summary) return null;
	const classes = [className, clampLines ? CLAMP_CLASS[clampLines] : null].filter(Boolean).join(" ");
	return <p className={classes || undefined}>{summary}</p>;
}

export function StructuredContentFull({ content, fallback, className, maxBullets, iconSizeClass = "size-3", iconSize = 11, iconColor, bulletItemClassName }: FullProps) {
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
							{bullet.iconNode && bullet.iconNode.length > 0 ? (
								<Icon node={bullet.iconNode} size={iconSize} strokeWidth={2} className={`${iconSizeClass} shrink-0`} style={iconStyle} />
							) : null}
							<span className="min-w-0 flex-1">{bullet.text}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/**
 * `true` when there is anything to render (summary text or at least one
 * bullet). Surfaces use this to decide whether to allocate space for the
 * content block at all.
 */
export function hasRenderableContent(content?: StructuredContent, fallback?: string): boolean {
	if (hasStructuredContent(content)) return true;
	return Boolean(fallback?.trim().length);
}
