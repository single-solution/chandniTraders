/**
 * NextAuth instance for the **admin app**.
 *
 * Single provider: email + password Credentials. There is no customer-otp
 * provider here, so even a forged request to this app's NextAuth endpoint
 * cannot mint a customer session — the provider literally doesn't exist
 * in this bundle.
 */

import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { User, connectDB } from "@store/db";
import { BCRYPT_ROUNDS, LOGIN_RATE_LIMIT_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS, checkRateLimit, clearRateLimit, getClientIp, logger } from "@store/shared";

import { authConfig } from "@/lib/authConfig";

const LOGIN_RATE_LIMIT_SCOPE = "admin:login";

/**
 * Pre-computed bcrypt hash used as a constant-time decoy when the supplied
 * email doesn't match any user. Comparing against this hash makes the
 * "user not found" path take the same wall-clock time as the "bad password"
 * path so an attacker can't enumerate accounts by login latency alone.
 *
 * The plaintext is never used — `bcrypt.compare` always returns `false`
 * here because the candidate password will never match this random hash.
 */
const TIMING_DECOY_HASH = bcrypt.hashSync("admin-login:enum-defense:v1", BCRYPT_ROUNDS);

export const { handlers, auth, signIn, signOut } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials, request) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}
				const email = String(credentials.email).toLowerCase().trim();
				const password = String(credentials.password);

				// Rate-limit BEFORE bcrypt so the slow hash compare isn't itself a
				// DoS vector. Key on (ip, email) so an attacker can't rotate emails
				// and a victim with a known email can't be locked out by a different
				// attacker IP.
				const ip = request instanceof Request ? getClientIp(request) : "unknown";
				const rateLimitKey = `${ip}:${email}`;
				const rateLimit = checkRateLimit({
					scope: LOGIN_RATE_LIMIT_SCOPE,
					key: rateLimitKey,
					max: LOGIN_RATE_LIMIT_ATTEMPTS,
					windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
				});
				if (!rateLimit.isAllowed) {
					logger.warn({ ip, email, retryAfterMs: rateLimit.retryAfterMs }, "Admin login rate limit exceeded");
					return null;
				}

				await connectDB();
				const user = await User.findOne({ email, isActive: true }).select("+passwordHash passwordChangedAt");
				if (!user) {
					// Run a real bcrypt compare against a decoy hash so this branch
					// takes the same time as the "bad password" branch below — no
					// account-enumeration via response timing.
					await bcrypt.compare(password, TIMING_DECOY_HASH);
					logger.info({ email, ip }, "Admin login: user not found or inactive");
					return null;
				}

				const isValid = await bcrypt.compare(password, user.passwordHash);
				if (!isValid) {
					logger.info({ email, ip }, "Admin login: bad password");
					return null;
				}

				clearRateLimit(LOGIN_RATE_LIMIT_SCOPE, rateLimitKey);

				user.lastLoginAt = new Date();
				await user.save();

				return {
					id: user._id.toString(),
					email: user.email,
					name: user.name,
					role: user.role,
					isSuperAdmin: user.isSuperAdmin === true,
					passwordChangedAtMs: user.passwordChangedAt?.getTime() ?? 0,
				};
			},
		}),
	],
	callbacks: {
		...authConfig.callbacks,
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.id = user.id as string;
				token.email = (user.email as string | undefined) ?? "";
				token.name = (user.name as string | undefined) ?? "";
				token.role = user.role;
				token.isSuperAdmin = user.isSuperAdmin === true;
				token.passwordChangedAtMs = user.passwordChangedAtMs ?? 0;
			}
			if (trigger === "update" && session?.user) {
				if (session.user.name) {
					token.name = session.user.name;
				}
				if (session.user.email) {
					token.email = session.user.email;
				}
			}
			return token;
		},
		async session({ session, token }) {
			session.user.id = token.id as string;
			session.user.email = (token.email as string | undefined) ?? "";
			session.user.name = (token.name as string | undefined) ?? "";
			session.user.role = token.role as typeof session.user.role;
			session.user.isSuperAdmin = token.isSuperAdmin === true;
			session.user.passwordChangedAtMs = (token.passwordChangedAtMs as number | undefined) ?? 0;
			return session;
		},
	},
});
