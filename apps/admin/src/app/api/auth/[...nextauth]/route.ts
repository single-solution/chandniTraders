import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Wrap NextAuth's handlers so the admin session cookie is **always** written
 * as a true browser-session cookie — no `Expires`, no `Max-Age`.
 *
 * Auth.js v5 has no public knob for this; it always writes `expires` on its
 * session cookie based on `session.maxAge`. We post-process every response
 * that sets the admin session cookie and strip both `Expires=…` and
 * `Max-Age=…`, which makes browsers drop the cookie on tab/browser close.
 *
 * The JWT itself still has a hard cap (configured in `authConfig.ts`), so a
 * copied cookie cannot live forever even if the host's browser is left open
 * — belt + suspenders.
 */

const COOKIE_NAME_PREFIXES = ["admin.session-token", "__Secure-admin.session-token"];

function stripExpiry(cookie: string): string {
	return cookie.replace(/;\s*Expires=[^;]+/gi, "").replace(/;\s*Max-Age=[^;]+/gi, "");
}

function shouldStrip(cookie: string): boolean {
	return COOKIE_NAME_PREFIXES.some((name) => cookie.startsWith(`${name}=`));
}

/**
 * Return a new Response with the admin session cookie's `Expires` / `Max-Age`
 * stripped. Other cookies pass through untouched. Returns the original
 * response when no admin cookie is present (the common case for the GET
 * /providers and similar endpoints).
 */
function stripCookiePersistence(response: Response): Response {
	const all = response.headers.getSetCookie?.() ?? [];
	if (all.length === 0) {
		return response;
	}

	const matched = all.some(shouldStrip);
	if (!matched) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.delete("set-cookie");
	for (const cookie of all) {
		headers.append("set-cookie", shouldStrip(cookie) ? stripExpiry(cookie) : cookie);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export const GET = async (request: NextRequest) => stripCookiePersistence(await handlers.GET(request));

export const POST = async (request: NextRequest) => stripCookiePersistence(await handlers.POST(request));
