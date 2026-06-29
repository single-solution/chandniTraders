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

/** Routes anonymous visitors can hit inside the admin app. */
const ADMIN_PUBLIC_ROUTES = ["/login"] as const;

/**
 * Roles allowed to hold an admin session. Duplicated from `User.USER_ROLES`
 * because that module pulls in Mongoose, which the edge runtime rejects.
 * Keep this in sync with `User.USER_ROLES` (typecheck below catches drift).
 */
const ADMIN_ROLES = ["owner", "business_manager", "product_manager", "marketing_manager", "support_staff"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

function isAdminRole(role: unknown): role is AdminRole {
	return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Auth.js config for the **admin app**.
 *
 * - Cookie is a true session cookie (no `maxAge`) — closing the browser
 *   logs admins out. JWT itself still has a hard upper bound to limit the
 *   lifetime of a stolen cookie.
 * - This app does not understand the `customer` role. The customer cookie
 *   is on a different name and host, so this app would never receive it,
 *   but the gate below also rejects anything other than admin roles
 *   defensively.
 * - Edge-safe: no Mongoose / bcrypt imports here. DB-touching code lives
 *   in `lib/auth.ts`.
 */
export const authConfig: NextAuthConfig = {
	providers: [],
	pages: {
		signIn: "/login",
	},
	session: {
		strategy: "jwt",
		maxAge: SESSION_MAX_AGE_DAYS * SECONDS_PER_DAY,
	},
	cookies: {
		sessionToken: {
			// Distinct cookie name from the storefront so neither app can read or
			// be tricked into accepting the other's cookie even on the same host.
			name: isProduction ? "__Secure-admin.session-token" : "admin.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: isProduction,
				// Omitting `maxAge` makes this a session cookie. The browser drops
				// it on close, even though the JWT still has a longer hard limit.
				maxAge: undefined,
			},
		},
	},
	callbacks: {
		/**
		 * Everything except the explicit public routes (`/login`, etc.) requires
		 * an authenticated admin session. Customer cookies cannot reach this
		 * app — the cookie name is admin-specific and the customer host is
		 * different — but we still defensively reject any non-admin role.
		 */
		authorized({ auth, request: { nextUrl } }) {
			const { pathname } = nextUrl;
			const role = auth?.user?.role;
			const isLoggedIn = Boolean(auth?.user);

			const isPublicRoute = ADMIN_PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
			if (isPublicRoute) {
				if (isLoggedIn && pathname === "/login") {
					return Response.redirect(new URL("/", nextUrl));
				}
				return true;
			}

			if (!isLoggedIn) {
				return false;
			}
			// Customer cookies can't reach this app (different cookie name + host),
			// but the role check defends in depth against any future cross-app
			// misconfiguration that might let one slip through.
			if (role && !isAdminRole(role)) {
				return false;
			}
			return true;
		},
	},
};
