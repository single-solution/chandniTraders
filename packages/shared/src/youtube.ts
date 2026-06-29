/**
 * Minimal YouTube URL handling for grade inspection videos.
 *
 * The `Grade.video` field stores a single string that may be either a
 * CDN-hosted file URL (uploaded mp4/webm) or a YouTube link. Storefront
 * and admin both call `parseYouTubeId` to decide which player to render
 * — `<video>` for the former, `<iframe>` for the latter.
 *
 * Supported input shapes:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtube.com/watch?v=ID&t=12
 *   https://m.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://youtu.be/ID?t=12
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube-nocookie.com/embed/ID
 */

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/** Returns the 11-character YouTube video ID, or `null` if the URL isn't recognisable. */
export function parseYouTubeId(input: string | null | undefined): string | null {
	const raw = (input ?? "").trim();
	if (!raw) return null;

	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		// Allow a bare 11-char ID as a courtesy (e.g. admin pastes just the ID).
		return YOUTUBE_ID_REGEX.test(raw) ? raw : null;
	}

	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	if (host === "youtu.be") {
		const id = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
		return YOUTUBE_ID_REGEX.test(id) ? id : null;
	}

	if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") {
		return null;
	}

	const watchId = url.searchParams.get("v");
	if (watchId && YOUTUBE_ID_REGEX.test(watchId)) return watchId;

	const segments = url.pathname.split("/").filter(Boolean);
	if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "v") {
		const id = segments[1] ?? "";
		return YOUTUBE_ID_REGEX.test(id) ? id : null;
	}

	return null;
}

/** True when the string parses to a YouTube link (or bare ID). */
export function isYouTubeUrl(input: string | null | undefined): boolean {
	return parseYouTubeId(input) !== null;
}

/**
 * Build a privacy-enhanced embed URL for an `<iframe>`.
 * Returns `null` when the input isn't a YouTube link.
 */
export function toYouTubeEmbedUrl(input: string | null | undefined): string | null {
	const id = parseYouTubeId(input);
	if (!id) return null;
	return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}
