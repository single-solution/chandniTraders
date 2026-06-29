import type { NextAuthConfig } from "next-auth";

/**
 * Tiny constants are inlined so this file (and the middleware that imports
 * it) stay edge-runtime safe — barrelling through `@store/shared` pulls
 * pino in transitively, which the edge bundler rejects.
 */
const SECONDS_PER_DAY = 60 * 60 * 24;
const SESSION_MAX_AGE_DAYS = 30;

/** Inline (rather than imported) to keep this module edge-bundler safe. */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Auth.js config for the **storefront**.
 *
 * - Only role this app understands is `customer`. There is no admin code in
 *   this bundle and the admin app runs on a different host with a different
 *   cookie name, so there's no way to crossover even if a malicious customer
 *   tampers with their own JWT claims.
 * - Cookie is **persistent** (matches the JWT lifetime) — customers stay
 *   signed in across browser restarts so the cart / account stay
 *   handy. The admin app makes the opposite trade-off.
 * - Edge-safe: no Mongoose / bcrypt imports in this file. Anything that
 *   needs the DB lives in `lib/auth.ts`.
 */
export const authConfig: NextAuthConfig = {
	providers: [],
	pages: {
		signIn: "/account/sign-in",
	},
	session: {
		strategy: "jwt",
		maxAge: SESSION_MAX_AGE_DAYS * SECONDS_PER_DAY,
	},
	cookies: {
		sessionToken: {
			// Distinct cookie name so a hostile process can't impersonate a session
			// by reusing the admin app's cookie name (and vice versa).
			name: isProduction ? "__Secure-web.session-token" : "web.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: isProduction,
				// Persistent — same lifetime as the JWT. Customers stay signed in
				// across browser restarts (the storefront's UX target).
				maxAge: SESSION_MAX_AGE_DAYS * SECONDS_PER_DAY,
			},
		},
	},
	callbacks: {
		/**
		 * Storefront has only one gated section: /account/**. Everything else is
		 * public. Unauthenticated requests get redirected to /account/sign-in
		 * with a `next=` hint so we can return them after sign-in.
		 */
		authorized({ auth, request: { nextUrl } }) {
			const { pathname } = nextUrl;
			const isLoggedIn = Boolean(auth?.user);

			if (!pathname.startsWith("/account")) {
				return true;
			}
			if (pathname.startsWith("/account/sign-in")) {
				if (!isLoggedIn) {
					return true;
				}
				// `next` is attacker-controlled — only honour same-origin paths
				// so we can't be turned into an open redirect.
				const requested = nextUrl.searchParams.get("next");
				const safeNext = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/account";
				return Response.redirect(new URL(safeNext, nextUrl));
			}
			if (!isLoggedIn) {
				const url = new URL("/account/sign-in", nextUrl);
				url.searchParams.set("next", pathname);
				return Response.redirect(url);
			}
			return true;
		},
	},
};
