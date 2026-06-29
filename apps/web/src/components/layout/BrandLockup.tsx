/**
 * Storefront brand lockup — the linked logo + wordmark that sits at
 * the top-left of every shell (desktop header, mobile header, footer).
 *
 * Rules:
 *   1. If the admin has uploaded a brand logo for the surface tone
 *      (light / dark), render it as the badge. Width is bounded so a
 *      tall/wide source still fits the chrome — `object-contain`
 *      preserves aspect ratio inside that box.
 *   2. If no logo is uploaded, render the wordmark only — no
 *      `ShoppingBag` placeholder badge. This is the explicit
 *      "text-only fallback" contract the admin sees on the Settings
 *      page.
 *   3. `siteName` is always shown next to the badge. Brands often want
 *      the wordmark visible even when there *is* an icon (recall
 *      ratio); designers can simply not upload a logo to lose the
 *      badge.
 *
 * Consumers pass `tone="light"` on light surfaces (top headers) and
 * `tone="dark"` on the footer. The wrapper colours the wordmark
 * accordingly so we don't repeat that token in every call site.
 */

import Link from "next/link";

import { classNames } from "@store/shared";

interface BrandLockupProps {
	/** Where the brand mark links to. Always `/` in practice. */
	href: string;
	/** Visible wordmark, also used as the link's accessible label. */
	siteName: string;
	/** Optional uploaded logo URL. Empty string ⇒ text-only mode. */
	logoUrl?: string;
	/** Surface tone — controls wordmark colour. */
	tone: "light" | "dark";
	/** Size preset; larger = bigger badge box + heavier wordmark scale. */
	size?: "sm" | "md";
	className?: string;
}

const BADGE_BOX: Record<NonNullable<BrandLockupProps["size"]>, string> = {
	sm: "h-8 w-auto max-w-[3rem]",
	md: "h-9 w-auto max-w-[3.5rem]",
};

const WORDMARK: Record<NonNullable<BrandLockupProps["size"]>, string> = {
	sm: "text-lg",
	md: "text-2xl",
};

const TONE_TEXT: Record<BrandLockupProps["tone"], string> = {
	light: "text-[var(--color-ink-900)]",
	dark: "text-[var(--color-on-dark)]",
};

export function BrandLockup({ href, siteName, logoUrl, tone, size = "md", className }: BrandLockupProps) {
	const hasLogo = Boolean(logoUrl && logoUrl.trim().length > 0);

	return (
		<Link href={href} aria-label={siteName} className={classNames("brand-lockup flex items-center gap-2.5", TONE_TEXT[tone], className)}>
			{hasLogo ? (
				/* Plain <img>: the source is admin-uploaded so the dimensions
           are unknown at build time, and `next/image` would also need
           the storage host in the `images.remotePatterns` allowlist —
           an extra config step the admin shouldn't have to think about
           for an uploaded brand mark. */
				// eslint-disable-next-line @next/next/no-img-element
				<img src={logoUrl} alt="" className={classNames("object-contain", BADGE_BOX[size])} />
			) : null}
			<span className={classNames("font-semibold leading-none tracking-tight", WORDMARK[size])}>{siteName}</span>
		</Link>
	);
}
