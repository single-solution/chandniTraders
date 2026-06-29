/**
 * Magic-byte content-type sniffing for upload validation.
 *
 * Client-supplied `file.type` (MIME) is just a label set by the browser
 * from the file extension. An attacker can rename `payload.exe` to
 * `photo.png` and the browser will happily call it `image/png`. To meet
 * `security.md § File Upload Security` we re-check the **content** by
 * reading the file's leading bytes against well-known signatures.
 *
 * No third-party dep: the signatures we accept (JPEG, PNG, WebP, MP4,
 * WebM, PDF) are short and well-specified, so hand-rolling avoids
 * pulling another package into the bundle.
 */

import { Buffer } from "node:buffer";

/** Supported sniffable content types. */
export type SniffableMime = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm" | "application/pdf";

interface Signature {
	mime: SniffableMime;
	test: (bytes: Buffer) => boolean;
}

/** Minimum bytes we need to read to identify every supported format. */
export const SNIFF_BYTE_COUNT = 32;

const SIGNATURES: Signature[] = [
	{
		mime: "image/jpeg",
		test: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
	},
	{
		mime: "image/png",
		test: (bytes) =>
			bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
	},
	{
		mime: "image/webp",
		test: (bytes) => bytes.length >= 12 && bytes.slice(0, 4).toString("ascii") === "RIFF" && bytes.slice(8, 12).toString("ascii") === "WEBP",
	},
	{
		mime: "video/mp4",
		// ISO Base Media: `....ftyp` at offset 4. `ftyp` brand can be `isom`,
		// `mp42`, `mp41`, `iso2`, `avc1`, `M4V `, `M4A `, etc. — accept any
		// `ftyp` since browsers will use the MIME for playback.
		test: (bytes) => bytes.length >= 8 && bytes.slice(4, 8).toString("ascii") === "ftyp",
	},
	{
		mime: "video/webm",
		// EBML header — Matroska / WebM. 0x1A45DFA3.
		test: (bytes) => bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
	},
	{
		mime: "application/pdf",
		test: (bytes) => bytes.slice(0, 4).toString("ascii") === "%PDF",
	},
];

/**
 * Detect the content type of `bytes` by signature. Returns the matching MIME
 * or `null` if no known signature applies.
 *
 * Callers should pass at least {@link SNIFF_BYTE_COUNT} bytes.
 */
export function sniffContentType(bytes: Buffer): SniffableMime | null {
	if (bytes.length < 4) {
		return null;
	}
	for (const signature of SIGNATURES) {
		if (signature.test(bytes)) {
			return signature.mime;
		}
	}
	return null;
}

/**
 * Verify that `bytes` actually contains content of `claimedMime`.
 *
 * Returns `null` when the sniffed type matches the claim, or an error message
 * suitable for a 415 response when it does not.
 *
 * Note: not all MIME types have a stable signature (e.g. `text/plain` is
 * just bytes). For those, callers should validate elsewhere. This function
 * accepts a no-match when `claimedMime` is outside the sniffable set and
 * returns `null` — callers must enforce the MIME allowlist separately.
 */
export function assertContentTypeMatches(bytes: Buffer, claimedMime: string): string | null {
	const sniffed = sniffContentType(bytes);
	if (!sniffed) {
		return `File content does not match any supported type.`;
	}
	if (sniffed !== claimedMime) {
		return `File content (${sniffed}) does not match declared type (${claimedMime}).`;
	}
	return null;
}
