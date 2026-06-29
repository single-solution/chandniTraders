/**
 * OTP service.
 *
 * - `issueCode` creates a fresh code, hashes it, persists it, and asks the
 *   provider to deliver it. Re-uses an in-flight code if it was issued in
 *   the last `OTP_RESEND_THROTTLE_MS` to avoid spamming the customer's
 *   phone if they double-tap "Send code".
 * - `verifyCode` checks the latest unconsumed code for the phone, increments
 *   `attempts`, and on success marks `consumedAt` so the code can't be
 *   replayed.
 *
 * Security:
 *   - Codes are never stored in plaintext.
 *   - Bad attempts are rate-limited and the row is invalidated after 5
 *     wrong tries to prevent brute-forcing.
 */

import bcrypt from "bcryptjs";

import { OtpCode, connectDB, getStoreSettings } from "@store/db";
import { BCRYPT_ROUNDS, logger, OTP_CODE_LENGTH, PHONE_TAIL_LENGTH, phoneFingerprint } from "@store/shared";

import { getOtpProvider } from "@/lib/otp/provider";

const MS_PER_MINUTE = 60_000;
const OTP_TTL_MINUTES = 5;
const OTP_RESEND_THROTTLE_MINUTES = 1;

const OTP_TTL_MS = OTP_TTL_MINUTES * MS_PER_MINUTE;
const OTP_RESEND_THROTTLE_MS = OTP_RESEND_THROTTLE_MINUTES * MS_PER_MINUTE;
const OTP_MAX_ATTEMPTS = 5;

/** Decimal base used when converting random bytes into OTP digits. */
const DECIMAL_RADIX = 10;
/** Defensive cap so a hostile caller can't blow the column with a 1MB phone. */
const PHONE_RAW_MAX_CHARS = 64;

interface IssueResult {
	ok: true;
	/** Last 4 digits of the canonical phone, for UI confirmation only. */
	phoneTail: string;
	expiresAt: string;
	/** True if a still-valid code was reused instead of issuing a new one. */
	reused: boolean;
}

interface IssueErrorTooSoon {
	ok: false;
	error: "too-soon";
	retryAfterMs: number;
}

interface IssueErrorBadInput {
	ok: false;
	error: "invalid-phone";
}

interface IssueErrorDelivery {
	ok: false;
	error: "delivery-failed";
}

type IssueResponse = IssueResult | IssueErrorTooSoon | IssueErrorBadInput | IssueErrorDelivery;

/** Generate `OTP_CODE_LENGTH` decimal digits using the crypto-strong PRNG. */
function generateOtp(): string {
	const bytes = new Uint8Array(OTP_CODE_LENGTH);
	globalThis.crypto.getRandomValues(bytes);
	let digits = "";
	for (let i = 0; i < OTP_CODE_LENGTH; i += 1) {
		digits += (bytes[i] % DECIMAL_RADIX).toString();
	}
	return digits;
}

export async function issueCode(input: { phoneRaw: string; purpose: "customer-signin" }): Promise<IssueResponse> {
	const fingerprint = phoneFingerprint(input.phoneRaw);
	if (!fingerprint) {
		return { ok: false, error: "invalid-phone" };
	}

	await connectDB();

	// Look for a recently issued, unconsumed code — throttle re-sends.
	const recent = await OtpCode.findOne({
		phoneFingerprint: fingerprint,
		purpose: input.purpose,
		consumedAt: { $exists: false },
		expiresAt: { $gt: new Date() },
	})
		.sort({ createdAt: -1 })
		.lean<{ createdAt: Date; expiresAt: Date }>();

	if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_THROTTLE_MS) {
		return {
			ok: false,
			error: "too-soon",
			retryAfterMs: OTP_RESEND_THROTTLE_MS - (Date.now() - recent.createdAt.getTime()),
		};
	}

	const code = generateOtp();
	const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
	const expiresAt = new Date(Date.now() + OTP_TTL_MS);

	const otpDoc = await OtpCode.create({
		phoneFingerprint: fingerprint,
		phoneRaw: input.phoneRaw.trim().slice(0, PHONE_RAW_MAX_CHARS),
		codeHash,
		purpose: input.purpose,
		expiresAt,
	});

	try {
		const { siteName } = await getStoreSettings();
		await (await getOtpProvider()).send({
			phoneFingerprint: fingerprint,
			phoneRaw: input.phoneRaw,
			code,
			expiresInMinutes: Math.round(OTP_TTL_MS / MS_PER_MINUTE),
			brand: siteName,
		});
	} catch (error) {
		logger.error({ error, phoneFingerprint: fingerprint }, "OTP delivery failed");
		await OtpCode.deleteOne({ _id: otpDoc._id });
		return { ok: false, error: "delivery-failed" };
	}

	return {
		ok: true,
		reused: false,
		phoneTail: fingerprint.slice(-PHONE_TAIL_LENGTH),
		expiresAt: expiresAt.toISOString(),
	};
}

type VerifyResult = { ok: true; phoneFingerprint: string; phoneRaw: string } | { ok: false; error: "invalid-phone" | "expired" | "exhausted" | "wrong-code" };

export async function verifyCode(input: { phoneRaw: string; code: string; purpose: "customer-signin" }): Promise<VerifyResult> {
	const fingerprint = phoneFingerprint(input.phoneRaw);
	if (!fingerprint) {
		return { ok: false, error: "invalid-phone" };
	}
	const trimmed = input.code.trim();
	// OTP must be exactly OTP_CODE_LENGTH decimal digits — anything else can't
	// match a code we generated, so reject it before hitting the DB.
	if (!new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(trimmed)) {
		return { ok: false, error: "wrong-code" };
	}

	await connectDB();

	const candidate = await OtpCode.findOne({
		phoneFingerprint: fingerprint,
		purpose: input.purpose,
		consumedAt: { $exists: false },
	})
		.sort({ createdAt: -1 })
		.select("+codeHash");

	if (!candidate) {
		return { ok: false, error: "wrong-code" };
	}

	if (candidate.expiresAt.getTime() < Date.now()) {
		return { ok: false, error: "expired" };
	}

	if (candidate.attempts >= OTP_MAX_ATTEMPTS) {
		return { ok: false, error: "exhausted" };
	}

	const matches = await bcrypt.compare(trimmed, candidate.codeHash);

	if (!matches) {
		candidate.attempts += 1;
		if (candidate.attempts >= OTP_MAX_ATTEMPTS) {
			candidate.consumedAt = new Date();
			logger.warn({ phoneFingerprint: fingerprint }, "OTP exhausted after too many wrong attempts");
		}
		await candidate.save();
		return {
			ok: false,
			error: candidate.consumedAt ? "exhausted" : "wrong-code",
		};
	}

	candidate.consumedAt = new Date();
	await candidate.save();

	return { ok: true, phoneFingerprint: fingerprint, phoneRaw: candidate.phoneRaw };
}
