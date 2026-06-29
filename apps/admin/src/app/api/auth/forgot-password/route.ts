import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB, User, handleMongoError, getIntegrationSettings } from "@store/db";
import {
	logger,
	checkRateLimit,
	getClientIp,
	PASSWORD_RESET_RATE_LIMIT_ATTEMPTS,
	LOGIN_RATE_LIMIT_WINDOW_MS,
	parseBody,
	badRequest,
} from "@store/shared";
import { sendResendEmail } from "@store/shared/server";

const FORGOT_PASSWORD_RATE_LIMIT_SCOPE = "admin:forgot-password";
const TOKEN_BYTES = 32;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const TOKEN_EXPIRY_MS = 60 * MS_PER_MINUTE;

interface ForgotPasswordBody {
	email?: unknown;
}

async function resolveAdminBaseUrl(): Promise<string> {
	const integration = await getIntegrationSettings();
	const adminSite = integration.adminSiteUrl.trim();
	if (adminSite) {
		return adminSite.replace(/\/$/, "");
	}
	const authUrl = process.env.AUTH_URL?.trim();
	if (authUrl) {
		return authUrl.replace(/\/$/, "");
	}
	return "";
}

export async function POST(request: Request) {
	const parsed = await parseBody<ForgotPasswordBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}

	const { email } = parsed;

	if (!email || typeof email !== "string") {
		return badRequest("A valid email address is required.");
	}

	const normalizedEmail = email.toLowerCase().trim();

	const ip = getClientIp(request);
	const rateLimitKey = `${ip}:${normalizedEmail}`;
	const rateLimit = checkRateLimit({
		scope: FORGOT_PASSWORD_RATE_LIMIT_SCOPE,
		key: rateLimitKey,
		max: PASSWORD_RESET_RATE_LIMIT_ATTEMPTS,
		windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
	});

	if (!rateLimit.isAllowed) {
		logger.warn({ ip, email: normalizedEmail, retryAfterMs: rateLimit.retryAfterMs }, "Admin forgot password rate limit exceeded");
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / MS_PER_SECOND)) } },
		);
	}

	try {
		await connectDB();
		const user = await User.findOne({ email: normalizedEmail, isActive: true });

		if (!user) {
			logger.info({ email: normalizedEmail }, "Forgot password requested for non-existent or inactive user");
			return NextResponse.json({ message: "If an account exists, a reset link has been sent." }, { status: 200 });
		}

		const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
		const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
		const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

		user.resetPasswordToken = hashedToken;
		user.resetPasswordExpiresAt = expiresAt;
		await user.save();

		const adminBase = await resolveAdminBaseUrl();
		const resetPath = adminBase ? `${adminBase}/login/reset-password?token=${rawToken}` : `/login/reset-password?token=${rawToken}`;
		const emailSent = await sendResendEmail({
			to: user.email,
			subject: "Reset your admin password",
			text: [
				"Use the link below to reset your admin password.",
				"This link expires in 1 hour.",
				"",
				resetPath,
				"",
				"If you did not request this, you can ignore this email.",
			].join("\n"),
		});

		if (!emailSent) {
			logger.warn({ userId: String(user.id) }, "Password reset token saved but Resend is not configured");
		} else {
			logger.info({ userId: String(user.id) }, "Password reset email sent");
		}

		return NextResponse.json({ message: "If an account exists, a reset link has been sent." }, { status: 200 });
	} catch (error) {
		return handleMongoError(error);
	}
}
