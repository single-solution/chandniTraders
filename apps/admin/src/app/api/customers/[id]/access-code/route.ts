import bcrypt from "bcryptjs";

import { requireSession } from "@/lib/api/requireSession";
import { connectDB, Customer, handleMongoError, OtpCode } from "@store/db";
import { BCRYPT_ROUNDS, OTP_CODE_LENGTH, badRequest, isValidId, notFound, ok, phoneFingerprint } from "@store/shared";

import { recordActivity } from "@/lib/services/activityLog";

interface RouteContext {
	params: Promise<{ id: string }>;
}

/** Admin-issued codes live longer than SMS codes — the operator reads them
 *  to the customer over the phone, so the 5-minute SMS window is too tight. */
const MANUAL_CODE_TTL_MINUTES = 15;
const MS_PER_MINUTE = 60_000;
const DECIMAL_RADIX = 10;
/** Phone-raw cap mirrors the OtpCode schema's verbatim column. */
const PHONE_RAW_MAX_CHARS = 64;

/** Crypto-strong decimal code, same shape the storefront verifier expects. */
function generateNumericCode(): string {
	const bytes = new Uint8Array(OTP_CODE_LENGTH);
	globalThis.crypto.getRandomValues(bytes);
	let digits = "";
	for (let index = 0; index < OTP_CODE_LENGTH; index += 1) {
		digits += (bytes[index] % DECIMAL_RADIX).toString();
	}
	return digits;
}

/**
 * Issue a one-time storefront sign-in code for a customer who can't receive an
 * OTP (delivery failing, no SMS, etc.). The plaintext is returned to the
 * operator to read out; the customer enters it on the normal storefront login.
 *
 * Reuses the storefront OTP machinery: we write a hashed `OtpCode` keyed by the
 * customer's phone fingerprint, which the existing `verifyCode` flow will match
 * with no storefront changes.
 */
export async function POST(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("customer_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	try {
		await connectDB();
		const customer = await Customer.findById(id).lean<{
			_id: unknown;
			name: string;
			phoneNumber: string;
		}>();
		if (!customer) {
			return notFound("Customer not found");
		}

		const fingerprint = phoneFingerprint(customer.phoneNumber);
		if (!fingerprint) {
			return badRequest("This customer has no valid phone number, so a sign-in code can't be issued.");
		}

		const code = generateNumericCode();
		const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
		const expiresAt = new Date(Date.now() + MANUAL_CODE_TTL_MINUTES * MS_PER_MINUTE);

		// Retire any still-live codes for this phone so only the one we just read
		// out to the customer can be used.
		await OtpCode.updateMany(
			{
				phoneFingerprint: fingerprint,
				purpose: "customer-signin",
				consumedAt: { $exists: false },
			},
			{ $set: { consumedAt: new Date() } },
		);

		await OtpCode.create({
			phoneFingerprint: fingerprint,
			phoneRaw: customer.phoneNumber.trim().slice(0, PHONE_RAW_MAX_CHARS),
			codeHash,
			purpose: "customer-signin",
			expiresAt,
		});

		void recordActivity({
			actor,
			action: "signin_code_issued",
			resourceType: "customer",
			resourceId: id,
			resourceLabel: customer.name,
			detail: `Issued a manual sign-in code (valid ${MANUAL_CODE_TTL_MINUTES} minutes)`,
		});

		return ok({
			code,
			expiresAt: expiresAt.toISOString(),
			expiresInMinutes: MANUAL_CODE_TTL_MINUTES,
		});
	} catch (error) {
		return handleMongoError(error);
	}
}
