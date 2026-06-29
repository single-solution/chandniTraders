import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { getVerifiedSession, hasPermission, type VerifiedUser } from "@/lib/permissions";
import { API_RATE_LIMIT_REQUESTS, API_RATE_LIMIT_WINDOW_MS, checkRateLimit, forbidden, getClientIp, logger, tooManyRequests, unauthorized } from "@store/shared";

import type { PermissionKey } from "@/lib/permissionsCatalog";

const API_RATE_LIMIT_SCOPE = "api:admin";

/**
 * Defence-in-depth CSRF check. SameSite=Lax already blocks the common
 * cross-site POST attack, but verifying the Origin/Referer guards against
 * the edge cases (Lax-relaxed clients, intermediate proxies, etc.).
 *
 * We deliberately ALLOW requests with no Origin or Referer header — some
 * browsers strip them in privacy modes, and many same-origin GETs simply
 * don't carry them. SameSite=Lax remains the primary defence in those
 * cases. We only reject when the headers are present AND they point at a
 * different host than ours.
 */
function isSameOriginRequest(headersList: Headers): boolean {
	const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
	if (!host) {
		return true;
	}

	const origin = headersList.get("origin");
	const referer = headersList.get("referer");
	const candidate = origin ?? referer;
	if (!candidate || candidate === "null") {
		return true;
	}

	try {
		const parsed = new URL(candidate);
		const expected = host.split(",")[0]?.trim() ?? host;
		return parsed.host.toLowerCase() === expected.toLowerCase();
	} catch {
		return false;
	}
}

/**
 * Call this as the first line of every protected API handler. It runs the
 * standard auth + permission + rate-limit checks and returns either the
 * verified actor or a pre-baked HTTP response the caller should `return`
 * immediately.
 *
 * Reads the inbound request headers via Next's `headers()` helper so callers
 * don't need to pass `request` through.
 *
 * Usage:
 *   const { actor, response } = await requireSession("product_create");
 *   if (response) return response;
 *   // ...actor is guaranteed VerifiedUser here
 */
type RequireSessionResult = { actor: VerifiedUser; response: null } | { actor: null; response: NextResponse };

export async function requireSession(permission?: PermissionKey): Promise<RequireSessionResult> {
	const actor = await getVerifiedSession();
	if (!actor) {
		return { actor: null, response: unauthorized() };
	}

	if (permission && !hasPermission(actor, permission)) {
		logger.warn({ userId: actor.id, permission }, "Permission denied");
		return { actor: null, response: forbidden() };
	}

	// Rate-limit by user ID first, with IP as a secondary scope so a single
	// compromised IP can't burn a user's whole budget.
	const headersList = await headers();
	if (!isSameOriginRequest(headersList)) {
		logger.warn({ userId: actor.id }, "Cross-origin admin API request rejected");
		return { actor: null, response: forbidden("Cross-origin request rejected.") };
	}
	const ip = getClientIp(headersList);
	const rateLimit = checkRateLimit({
		scope: API_RATE_LIMIT_SCOPE,
		key: `${actor.id}:${ip}`,
		max: API_RATE_LIMIT_REQUESTS,
		windowMs: API_RATE_LIMIT_WINDOW_MS,
	});
	if (!rateLimit.isAllowed) {
		logger.warn({ userId: actor.id, ip, retryAfterMs: rateLimit.retryAfterMs }, "API rate limit exceeded");
		return { actor: null, response: tooManyRequests(rateLimit.retryAfterMs) };
	}

	return { actor, response: null };
}
