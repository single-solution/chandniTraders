/**
 * In-memory token-bucket rate limiter — per security.md § Rate Limiting.
 *
 * This is single-process only. For multi-region or multi-instance production
 * deployments swap the backing store for Redis / Upstash with the same
 * `RateLimiter` interface. The enforcement contract (key → allowed/denied +
 * Retry-After) stays identical.
 */

interface Bucket {
	/** Number of attempts recorded in the current window. */
	count: number;
	/** Wall-clock millis when the current window started. */
	windowStartedAt: number;
}

interface RateLimitResult {
	isAllowed: boolean;
	/** Milliseconds the caller should wait before retrying (only when denied). */
	retryAfterMs: number;
	/** Remaining attempts inside the current window (informational). */
	remaining: number;
}

interface RateLimitOptions {
	/** Logical bucket name — keeps separate counters for separate flows. */
	scope: string;
	/** Stable identifier (e.g. `${ip}:${email}`) — what we count attempts against. */
	key: string;
	/** Max attempts allowed inside `windowMs`. */
	max: number;
	/** Window length in milliseconds. */
	windowMs: number;
}

import { MS_PER_MINUTE } from "./constants";

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;
/** Run the GC sweep at most once every 5 minutes. */
const SWEEP_INTERVAL_MS = 5 * MS_PER_MINUTE;
/** Keep a bucket up to this many windows past its last touch — anything
 *  older is provably idle and safe to evict. */
const STALE_WINDOW_MULTIPLIER = 4;

function sweep(now: number, windowMs: number) {
	if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
		return;
	}
	lastSweepAt = now;
	for (const [bucketKey, bucket] of buckets) {
		if (now - bucket.windowStartedAt > windowMs * STALE_WINDOW_MULTIPLIER) {
			buckets.delete(bucketKey);
		}
	}
}

/**
 * Record an attempt and decide whether to allow it.
 *
 * - Counts increment on every call (use `peekRateLimit` if you only want to
 *   inspect without consuming a slot).
 * - Returns 429-friendly metadata so the caller can attach a `Retry-After`
 *   header.
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
	if (!options.key) {
		// No identifier → allow (caller should always pass an IP fallback).
		return { isAllowed: true, retryAfterMs: 0, remaining: options.max };
	}

	const now = Date.now();
	sweep(now, options.windowMs);

	const bucketKey = `${options.scope}::${options.key}`;
	const existing = buckets.get(bucketKey);

	if (!existing || now - existing.windowStartedAt > options.windowMs) {
		buckets.set(bucketKey, { count: 1, windowStartedAt: now });
		return { isAllowed: true, retryAfterMs: 0, remaining: options.max - 1 };
	}

	if (existing.count >= options.max) {
		const retryAfterMs = options.windowMs - (now - existing.windowStartedAt);
		return { isAllowed: false, retryAfterMs, remaining: 0 };
	}

	existing.count += 1;
	return {
		isAllowed: true,
		retryAfterMs: 0,
		remaining: Math.max(0, options.max - existing.count),
	};
}

/** Reset a bucket — call after successful login so the user can keep working. */
export function clearRateLimit(scope: string, key: string) {
	buckets.delete(`${scope}::${key}`);
}

/**
 * Best-effort client IP from any header source (Request or Headers). Trusts
 * the platform's standard proxy headers in priority order; falls back to a
 * synthetic value so keying never produces an empty string.
 */
export function getClientIp(source: Request | Headers): string {
	const headers = source instanceof Request ? source.headers : source;
	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor) {
		const first = forwardedFor.split(",")[0]?.trim();
		if (first) {
			return first;
		}
	}
	const realIp = headers.get("x-real-ip");
	if (realIp) {
		return realIp;
	}
	return "unknown";
}
