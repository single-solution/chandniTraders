/**
 * NextAuth instance for the **storefront**.
 *
 * Single provider: `customer-otp`. There is no admin Credentials provider
 * registered here, so even a request that handcrafts a `signIn("credentials", …)`
 * call against this app cannot create an admin session — the provider
 * literally doesn't exist in this bundle.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { Customer, connectDB } from "@store/db";
import { checkRateLimit, clearRateLimit, getClientIp, logger, normalizePhoneNumber, PHONE_TAIL_LENGTH, phoneFingerprint, SHORT_BURST_WINDOW_MS } from "@store/shared";

import { authConfig } from "@/lib/authConfig";
import { verifyCode } from "@/lib/otp/service";
import { claimInquiriesForCustomer } from "@/lib/server/inquiryClaim";

const OTP_RATE_LIMIT_SCOPE = "auth:customer-otp";
/**
 * Customer OTP attempts per IP+phone within a 15-minute window. Set high
 * enough that a legitimate user mistyping the code a few times never
 * locks themselves out, low enough that brute-forcers stall quickly.
 */
const CUSTOMER_OTP_ATTEMPTS_PER_WINDOW = 10;

export const { handlers, auth, signIn, signOut } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			id: "customer-otp",
			name: "customer-otp",
			credentials: {
				phoneNumber: { label: "Phone", type: "tel" },
				code: { label: "Code", type: "text" },
			},
			async authorize(credentials, request) {
				const phone = typeof credentials?.phoneNumber === "string" ? credentials.phoneNumber.trim() : "";
				const code = typeof credentials?.code === "string" ? credentials.code.trim() : "";
				if (!phone || !code) {
					return null;
				}

				const ip = request instanceof Request ? getClientIp(request) : "unknown";
				const fingerprint = phoneFingerprint(phone) ?? phone;
				const rateLimit = checkRateLimit({
					scope: OTP_RATE_LIMIT_SCOPE,
					key: `${ip}:${fingerprint}`,
					max: CUSTOMER_OTP_ATTEMPTS_PER_WINDOW,
					windowMs: SHORT_BURST_WINDOW_MS,
				});
				if (!rateLimit.isAllowed) {
					logger.warn({ ip, fingerprint, retryAfterMs: rateLimit.retryAfterMs }, "Customer OTP rate limit exceeded");
					return null;
				}

				const result = await verifyCode({
					phoneRaw: phone,
					code,
					purpose: "customer-signin",
				});
				if (!result.ok) {
					logger.info({ ip, fingerprint, error: result.error }, "Customer OTP verify failed");
					return null;
				}

				await connectDB();
				// Key on the canonical +92… form so a customer always resolves to the
				// same record regardless of how they typed their number this time, and
				// so admin-created accounts (which store the same canonical form) link
				// to their self-service sign-in.
				const phoneNumber = normalizePhoneNumber(result.phoneRaw) ?? `+92${result.phoneFingerprint}`;
				const customer = await Customer.findOneAndUpdate(
					{ phoneNumber },
					{
						$setOnInsert: {
							phoneNumber,
							name: `Customer ${result.phoneFingerprint.slice(-PHONE_TAIL_LENGTH)}`,
							city: "—",
							addresses: [],
							isLoyaltyMember: false,
						},
					},
					{ new: true, upsert: true },
				);
				await claimInquiriesForCustomer({
					customerId: customer._id,
					phoneNumber: customer.phoneNumber,
				});

				clearRateLimit(OTP_RATE_LIMIT_SCOPE, `${ip}:${fingerprint}`);

				return {
					id: customer._id.toString(),
					name: customer.name,
					role: "customer",
					phoneNumber: customer.phoneNumber,
					customerId: customer._id.toString(),
				};
			},
		}),
	],
	callbacks: {
		...authConfig.callbacks,
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.name = (user.name as string | undefined) ?? "";
				token.role = "customer";
				token.phoneNumber = user.phoneNumber;
				token.customerId = user.customerId;
			}
			return token;
		},
		async session({ session, token }) {
			session.user.id = token.id as string;
			session.user.name = (token.name as string | undefined) ?? "";
			session.user.role = "customer";
			session.user.phoneNumber = token.phoneNumber as string | undefined;
			session.user.customerId = token.customerId as string | undefined;
			return session;
		},
	},
});
