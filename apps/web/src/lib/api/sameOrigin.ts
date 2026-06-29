import { forbidden, logger } from "@store/shared";

/**
 * Defence-in-depth CSRF check for authenticated storefront endpoints.
 *
 * SameSite=Lax already prevents the browser from attaching the session
 * cookie to cross-site form posts, but verifying the Origin/Referer header
 * gives us a second line of defence against bypasses (intermediate proxies,
 * misconfigured browsers, broken Lax enforcement on older clients).
 *
 * Returns a 403 response when the request is cross-origin; returns `null`
 * otherwise so callers can `if (response) return response;`.
 *
 * We deliberately do NOT reject when both Origin and Referer are missing —
 * some browsers strip them in privacy modes, and rejecting silently breaks
 * legitimate users. SameSite=Lax remains the primary protection there.
 */
export function enforceSameOrigin(request: Request): Response | null {
	const url = new URL(request.url);
	const expectedHost = url.host.toLowerCase();

	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");
	const candidate = origin ?? referer;
	if (!candidate || candidate === "null") {
		return null;
	}

	try {
		const parsed = new URL(candidate);
		if (parsed.host.toLowerCase() === expectedHost) {
			return null;
		}
		logger.warn({ expectedHost, actualHost: parsed.host }, "Cross-origin storefront API request rejected");
		return forbidden("Cross-origin request rejected.");
	} catch {
		return forbidden("Cross-origin request rejected.");
	}
}
