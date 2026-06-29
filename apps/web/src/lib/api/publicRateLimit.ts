/**
 * Rate-limit helpers tuned for anonymous storefront endpoints.
 *
 * Public endpoints have a different threat profile from the admin API: there
 * is no authenticated user, so we key off `ip` + a stable user-supplied
 * value (phone number for orders / inquiries) to limit drive-by abuse without
 * blocking shared NATs (e.g. an entire office behind one egress IP).
 *
 * Returns `null` when the request is allowed; returns a populated `Response`
 * when the caller should reject the request immediately. Callers should
 * `return` the response unmodified on a non-null result.
 */

import { checkRateLimit, getClientIp, SHORT_BURST_WINDOW_MS, tooManyRequests } from "@store/shared";

/** Default attempts per window when callers don't override `max`. */
const DEFAULT_MAX_ATTEMPTS = 5;

interface PublicRateLimitOptions {
	scope: string;
	/** A stable identifier from the request body (phone, email). Optional. */
	identifier?: string;
	/** Max attempts per window (default: 5). */
	max?: number;
	/** Window length in ms (default: 15 minutes). */
	windowMs?: number;
}

export function enforcePublicRateLimit(request: Request, options: PublicRateLimitOptions): Response | null {
	const ip = getClientIp(request);
	// Bind the bucket to ip + identifier so the same shop (NAT) can still serve
	// many distinct users; the abusive caller is the (ip, phone) pair.
	const key = options.identifier ? `${ip}:${options.identifier}` : ip;
	const { isAllowed, retryAfterMs } = checkRateLimit({
		scope: options.scope,
		key,
		max: options.max ?? DEFAULT_MAX_ATTEMPTS,
		windowMs: options.windowMs ?? SHORT_BURST_WINDOW_MS,
	});
	if (!isAllowed) {
		return tooManyRequests(retryAfterMs, "Too many requests, please try again later.");
	}
	return null;
}
