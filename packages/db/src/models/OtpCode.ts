/**
 * One-time passcodes for customer sign-in via phone.
 *
 * Codes are stored as bcrypt hashes — the raw 6-digit value is only ever
 * delivered to the customer (via WhatsApp) and to the server during
 * verification. We store the canonical 10-digit phone fingerprint so we
 * can index efficiently and ignore prefix noise.
 *
 * Codes auto-expire via a TTL index on `expiresAt`. Verification flips
 * `consumedAt` to a non-null value so the same code can't be re-used; we
 * keep the row around briefly so we can detect replay attacks in logs.
 */

import mongoose, { Schema, type Model } from "mongoose";

import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from "@store/shared";

const OTP_PURPOSES = ["customer-signin"] as const;
type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Hard bound on OTP-row retention — prevents the collection from growing
 *  unbounded even if the natural `expiresAt` is somehow set far in the future. */
const OTP_AUTO_PURGE_SECONDS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
/** Phone-raw maxlength in chars — paranoid cap on the kept-verbatim copy. */
const PHONE_RAW_MAX_CHARS = 64;
/** Phone-fingerprint maxlength — 10 digits is the canonical PK form, leave
 *  headroom for future country expansions without index churn. */
const PHONE_FINGERPRINT_MAX_CHARS = 32;

interface OtpCodeAttributes {
	/** 10-digit national fingerprint, e.g. `3204862403`. */
	phoneFingerprint: string;
	/** Raw phone string the customer entered, kept verbatim for support. */
	phoneRaw: string;
	/** bcrypt hash of the 6-digit code. */
	codeHash: string;
	purpose: OtpPurpose;
	attempts: number;
	expiresAt: Date;
	consumedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const otpSchema = new Schema<OtpCodeAttributes>(
	{
		phoneFingerprint: {
			type: String,
			required: true,
			trim: true,
			maxlength: PHONE_FINGERPRINT_MAX_CHARS,
			index: true,
		},
		phoneRaw: { type: String, required: true, trim: true, maxlength: PHONE_RAW_MAX_CHARS },
		codeHash: { type: String, required: true, select: false },
		purpose: { type: String, enum: OTP_PURPOSES, required: true },
		attempts: { type: Number, required: true, default: 0, min: 0 },
		expiresAt: { type: Date, required: true },
		consumedAt: { type: Date },
	},
	{ timestamps: true },
);

// Auto-purge after 1h regardless of expiry — keeps the collection bounded.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: OTP_AUTO_PURGE_SECONDS });
otpSchema.index({ phoneFingerprint: 1, purpose: 1, createdAt: -1 });

export const OtpCode: Model<OtpCodeAttributes> = (mongoose.models.OtpCode as Model<OtpCodeAttributes>) ?? mongoose.model<OtpCodeAttributes>("OtpCode", otpSchema);
