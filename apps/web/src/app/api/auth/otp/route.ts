/**
 * Issue (create) an OTP for customer sign-in.
 *
 * POST /api/auth/otp  { phoneNumber }
 *
 * - IP rate-limited to prevent OTP abuse.
 * - Phone-scoped resend throttling lives inside `issueCode`.
 * - Always returns `200 { phoneTail, expiresAt }` for plausibly-valid phones
 *   (we never reveal whether a number is registered with us).
 */

import { badRequest, ok, parseBody, phoneFingerprint, serverError, SHORT_BURST_WINDOW_MS, tooManyRequests } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { issueCode } from "@/lib/otp/service";

export const dynamic = "force-dynamic";

const INVALID_PHONE_MESSAGE = "Please enter a valid phone number.";
/** OTP issuance attempts per IP+phone within the short-burst window. */
const MAX_OTP_ISSUES_PER_WINDOW = 5;

interface IssueOtpBody {
	phoneNumber?: unknown;
}

export async function POST(request: Request) {
	const parsed = await parseBody<IssueOtpBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}
	const phone = typeof parsed.phoneNumber === "string" ? parsed.phoneNumber.trim() : "";

	// Rate limit per IP and (separately) per phone — stops both global SMS
	// bombing and targeted harassment of one number.
	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-otp-issue",
		identifier: phoneFingerprint(phone) ?? phone ?? undefined,
		max: MAX_OTP_ISSUES_PER_WINDOW,
		windowMs: SHORT_BURST_WINDOW_MS,
	});
	if (limited) {
		return limited;
	}

	if (!phone || !phoneFingerprint(phone)) {
		return badRequest(INVALID_PHONE_MESSAGE);
	}

	const result = await issueCode({ phoneRaw: phone, purpose: "customer-signin" });

	if (result.ok) {
		return ok({
			phoneTail: result.phoneTail,
			expiresAt: result.expiresAt,
		});
	}

	if (result.error === "too-soon") {
		return tooManyRequests(result.retryAfterMs, "Please wait a moment before requesting another code.");
	}

	if (result.error === "delivery-failed") {
		return serverError("Could not send the verification code. Please try again in a moment.");
	}

	return badRequest(INVALID_PHONE_MESSAGE);
}
