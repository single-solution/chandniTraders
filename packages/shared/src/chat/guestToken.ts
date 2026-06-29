/**
 * Guest thread tokens.
 *
 * Used by `Set-Cookie inquiry_thread_token=...` so an anonymous customer
 * who opens a chat can come back later (same browser, same cookie) and
 * see their thread history. The cookie payload is signed JWT (HS256)
 * using the existing `AUTH_SECRET`; no separate key to manage.
 *
 * Payload shape is intentionally tiny:
 *   - `inquiryIds`: the threads this cookie holder is allowed to read.
 *   - `phoneNumber`: snapshot at token-issue time, used when the visitor
 *     signs in to merge guest thread history into their account.
 *
 * We use `jose` (already in the dependency tree via Auth.js) so the
 * runtime works on Edge as well as Node without extra polyfills.
 */

import { jwtVerify, SignJWT } from "jose";

export interface GuestTokenPayload {
	inquiryIds: string[];
	phoneNumber: string;
}

export interface SignedGuestToken {
	token: string;
	/** Cookie max-age in seconds. */
	maxAgeSeconds: number;
}

const ALG = "HS256";
const ISSUER = "chandnitraders:chat";
const AUDIENCE = "chandnitraders:guest";

function getKey(): Uint8Array {
	const secret = process.env.AUTH_SECRET;
	if (!secret) {
		throw new Error("AUTH_SECRET is required to sign chat guest tokens. Set it in your environment.");
	}
	return new TextEncoder().encode(secret);
}

export async function signGuestToken(payload: GuestTokenPayload, options: { days: number }): Promise<SignedGuestToken> {
	if (!Array.isArray(payload.inquiryIds) || payload.inquiryIds.length === 0) {
		throw new Error("signGuestToken: at least one inquiryId is required.");
	}
	const maxAgeSeconds = options.days * 24 * 60 * 60;
	const token = await new SignJWT({
		inquiryIds: payload.inquiryIds,
		phoneNumber: payload.phoneNumber,
	})
		.setProtectedHeader({ alg: ALG })
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${options.days}d`)
		.sign(getKey());
	return { token, maxAgeSeconds };
}

export async function verifyGuestToken(token: string | undefined | null): Promise<GuestTokenPayload | null> {
	if (!token || typeof token !== "string") return null;
	try {
		const { payload } = await jwtVerify(token, getKey(), {
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		if (!Array.isArray(payload.inquiryIds)) return null;
		if (typeof payload.phoneNumber !== "string") return null;
		const inquiryIds = (payload.inquiryIds as unknown[]).filter((value): value is string => typeof value === "string");
		if (inquiryIds.length === 0) return null;
		return { inquiryIds, phoneNumber: payload.phoneNumber };
	} catch {
		return null;
	}
}

/**
 * Re-issue a token that's a superset of an existing one — used when a
 * guest starts another thread in the same browser and we want them to
 * see *all* their threads via one cookie.
 */
export async function appendInquiryToGuestToken(
	existingToken: string | undefined | null,
	newInquiryId: string,
	phoneNumber: string,
	options: { days: number },
): Promise<SignedGuestToken> {
	const existing = await verifyGuestToken(existingToken);
	const inquiryIds = existing ? Array.from(new Set([...existing.inquiryIds, newInquiryId])) : [newInquiryId];
	return signGuestToken({ inquiryIds, phoneNumber }, options);
}
