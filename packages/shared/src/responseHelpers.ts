import { NextResponse } from "next/server";
import { logger } from "./logger";
import { DECIMAL_RADIX, MAX_REQUEST_BODY_BYTES, MS_PER_SECOND } from "./constants";

// Mongo ObjectId hex shape — 24 lowercase hex chars. Avoids importing all
// of mongoose into this module (which the Edge bundler then refuses to
// transpile because the driver pulls in `fs`, `net`, `tls`, …).
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/** 200 OK response with JSON body. */
export function ok<T>(data: T) {
	return NextResponse.json(data, { status: 200 });
}

/** 201 Created response with JSON body. */
export function created<T>(data: T) {
	return NextResponse.json(data, { status: 201 });
}

/** 204 No Content response (no body). */
export function noContent() {
	return new NextResponse(null, { status: 204 });
}

/** 304 Not Modified — polling clients send If-None-Match / ?since. */
export function notModified(etag?: string) {
	const headers = etag ? { ETag: etag } : undefined;
	return new NextResponse(null, { status: 304, headers });
}

/** 400 Bad Request — caller-fixable problem with the request payload. */
export function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

/** 401 Unauthorized — caller is not authenticated. */
export function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** 403 Forbidden — authenticated, but lacks permission. */
export function forbidden(message = "Forbidden") {
	return NextResponse.json({ error: message }, { status: 403 });
}

/** 404 Not Found. */
export function notFound(message = "Not found") {
	return NextResponse.json({ error: message }, { status: 404 });
}

/** 409 Conflict — uniqueness violation, state conflict. */
export function conflict(message: string) {
	return NextResponse.json({ error: message }, { status: 409 });
}

/**
 * 422 Unprocessable Entity — body parsed, fields are syntactically valid, but
 * the request violates a business rule (insufficient balance, blocked state
 * transition, etc.). Reserve 400 for shape/format errors and 422 for
 * semantic ones.
 */
export function unprocessable(message: string) {
	return NextResponse.json({ error: message }, { status: 422 });
}

/**
 * 429 Too Many Requests — caller is being throttled. Accepts the retry-after
 * window in milliseconds (rate limiter native unit) and converts to the
 * seconds-based `Retry-After` header per RFC 9110.
 */
export function tooManyRequests(retryAfterMs?: number, message = "Too many requests") {
	const seconds = retryAfterMs && retryAfterMs > 0 ? Math.ceil(retryAfterMs / MS_PER_SECOND) : undefined;
	const headers = seconds ? { "Retry-After": String(seconds) } : undefined;
	return NextResponse.json({ error: message }, { status: 429, headers });
}

/** 500 Internal Server Error — unexpected failure on our side. */
export function serverError(message = "Internal server error") {
	return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * 413 Payload Too Large — used by `parseBody` when the body trips the cap.
 * Also re-exported for multipart upload handlers that enforce their own
 * size limit.
 */
export function payloadTooLarge(message: string) {
	return NextResponse.json({ error: message }, { status: 413 });
}

/** 415 Unsupported Media Type — file/MIME outside the allowlist. */
export function unsupportedMediaType(message: string) {
	return NextResponse.json({ error: message }, { status: 415 });
}

/**
 * Read JSON from a Request safely. Enforces a max body size (defends against
 * memory-exhaustion DoS) and returns 400 / 413 responses the caller can
 * return directly — saves a try/catch in every handler.
 */
export async function parseBody<T = unknown>(request: Request): Promise<T | Response> {
	const oversizedMessage = `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`;
	const declared = request.headers.get("content-length");
	if (declared !== null) {
		const size = Number.parseInt(declared, DECIMAL_RADIX);
		if (Number.isFinite(size) && size > MAX_REQUEST_BODY_BYTES) {
			return payloadTooLarge(oversizedMessage);
		}
	}

	try {
		const text = await request.text();
		if (text.length > MAX_REQUEST_BODY_BYTES) {
			return payloadTooLarge(oversizedMessage);
		}
		if (text.length === 0) {
			return badRequest("Request body is empty.");
		}
		// `JSON.parse` returns `any`; the caller's `<T>` is the contract they
		// promise to validate before trusting any field of this value.
		return JSON.parse(text) as T;
	} catch (error) {
		logger.debug({ error }, "Failed to parse request body as JSON");
		return badRequest("Invalid JSON body.");
	}
}

/** Validate a string id has Mongo ObjectId shape before querying. */
export function isValidId(id: unknown): id is string {
	return typeof id === "string" && OBJECT_ID_PATTERN.test(id);
}
