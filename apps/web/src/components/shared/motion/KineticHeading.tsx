"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Kinetic-punch headline (CSS-driven).
 *
 * Splits the provided text into per-character spans and runs a pure-CSS
 * keyframe when the heading enters the viewport. Each character drops in
 * from below (2D translate + fade) on a back-out spring for the signature
 * "punch" feel, with zero JS animation library (an IntersectionObserver
 * only toggles a class; the compositor does the rest). Strictly 2D — no
 * perspective/rotateX — so settled text stays pixel-crisp.
 *
 *   • Lines are kept as separate blocks so descenders/x-heights line up
 *     with the surrounding type — we never collapse them into one row.
 *   • Whitespace is a normal text node so the line-break algorithm only
 *     breaks between words; per-character `--kinetic-i` keeps the stagger
 *     continuous across multi-line headings.
 *   • `prefers-reduced-motion` is honoured in CSS — chars stay at their
 *     natural visible state and never animate.
 *   • The wrapper element type can be overridden via `as` (h1/h2/p).
 *
 * Usage:
 *   <KineticHeading as="h2" lines={["how it", "works"]} />
 */
export interface KineticHeadingProps {
	/** Text to animate. Pass an array for multi-line headings. */
	lines: string | readonly string[];
	/** Tag to render. Defaults to span (no semantic weight). */
	as?: ElementType;
	/** Stagger between characters in seconds. Defaults to 0.04. */
	stagger?: number;
	/** Delay before the timeline starts in seconds. */
	delay?: number;
	/** Skip the ScrollTrigger and fire immediately on mount. */
	immediate?: boolean;
	className?: string;
	/** Default class on every line wrapper. */
	lineClassName?: string;
	/** Per-line class names (serializable strings for RSC → client). Index
	 *  aligns with `lines` — omit or leave blank to fall back to
	 *  `lineClassName`. */
	lineClassNames?: readonly string[];
	style?: CSSProperties;
}

function splitCharacters(line: string, lineIndex: number, characterStartIndex: number): ReactNode[] {
	/* Split the line into word + whitespace tokens so the browser is
     only allowed to break BETWEEN words, never mid-word. Each word
     becomes an `inline-block` wrapper holding its per-character spans
     (the chars stay `inline-block` so GSAP can transform them
     individually). The whitespace between words is rendered as a
     normal text node — that's the only break opportunity the
     line-breaking algorithm sees, so single words like "Three" or
     "Welcome" can never be split across two lines.

     `globalIndex` increments per source character (including spaces
     we don't actually emit a span for) so the kinetic-stagger CSS
     index stays continuous across multi-line headings and matches
     the math in `lineStartIndexes`. */
	const tokens = line.split(/(\s+)/);
	const result: ReactNode[] = [];
	let cursor = 0;
	let wordCounter = 0;

	for (const token of tokens) {
		if (token.length === 0) {
			continue;
		}
		if (/^\s+$/.test(token)) {
			/* Wrap whitespace in a keyed span so the surrounding array
         doesn't trigger React's "missing key" warning, but leave
         the whitespace as plain text so the browser's line-break
         algorithm still treats it as a normal break opportunity
         between the word wrappers. */
			result.push(<span key={`l${lineIndex}-ws-${cursor}`}>{token}</span>);
			cursor += token.length;
			continue;
		}

		const chars: ReactNode[] = [];
		for (let i = 0; i < token.length; i++) {
			const char = token[i];
			const globalIndex = characterStartIndex + cursor + i;
			chars.push(
				<span
					key={`l${lineIndex}-c${cursor + i}`}
					className="kinetic-char inline-block"
					data-kinetic-char
					style={{ ["--kinetic-i" as string]: String(globalIndex) } as CSSProperties}
					aria-hidden
				>
					{char}
				</span>,
			);
		}
		result.push(
			<span key={`l${lineIndex}-w${wordCounter}`} className="kinetic-word inline-block whitespace-nowrap">
				{chars}
			</span>,
		);
		cursor += token.length;
		wordCounter += 1;
	}

	return result;
}

export function KineticHeading({
	lines,
	as: Tag = "span",
	stagger = 0.04,
	delay = 0,
	immediate = false,
	className = "",
	lineClassName = "",
	lineClassNames,
	style,
}: KineticHeadingProps) {
	const rootRef = useRef<HTMLElement | null>(null);
	const normalisedLines: readonly string[] = Array.isArray(lines) ? lines : [lines as string];
	const accessibleLabel = normalisedLines.join(" ").trim();

	useEffect(() => {
		const root = rootRef.current;
		if (!root) {
			return;
		}
		// Reduced-motion is handled in CSS; chars stay in their natural
		// visible state, so we never need to arm the animation.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		if (immediate) {
			root.classList.add("kinetic-animate");
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						root.classList.add("kinetic-animate");
						observer.disconnect();
						break;
					}
				}
			},
			// Mirrors the old GSAP "top 85%" start — fire once the heading is
			// ~15% into the viewport.
			{ rootMargin: "0px 0px -15% 0px", threshold: 0.01 },
		);
		observer.observe(root);
		return () => observer.disconnect();
	}, [immediate, accessibleLabel]);

	// Compute per-line character offsets up front (immutable map step)
	// so we never mutate a running cursor during the render mapping.
	const lineStartIndexes = normalisedLines.reduce<number[]>((acc, line, index) => {
		if (index === 0) {
			acc.push(0);
			return acc;
		}
		const prevLength = normalisedLines[index - 1]?.length ?? 0;
		acc.push((acc[index - 1] ?? 0) + prevLength);
		return acc;
	}, []);

	return (
		<Tag
			ref={rootRef as never}
			className={`kinetic-heading ${className}`.trim()}
			style={
				{
					"--kinetic-stagger": `${stagger}s`,
					"--kinetic-delay": `${delay}s`,
					...style,
				} as CSSProperties
			}
			aria-label={accessibleLabel || undefined}
		>
			{normalisedLines.map((line, lineIndex) => {
				const startIndex = lineStartIndexes[lineIndex] ?? 0;
				const characters = splitCharacters(line, lineIndex, startIndex);
				const perLineClass = lineClassNames?.[lineIndex] ?? lineClassName;
				return (
					<span key={`line-${lineIndex}`} className={`kinetic-line block ${perLineClass}`.trim()}>
						{characters}
					</span>
				);
			})}
		</Tag>
	);
}
