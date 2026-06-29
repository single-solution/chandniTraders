import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB, User, handleMongoError } from "@store/db";
import {
	logger,
	validatePassword,
	isValidationError,
	BCRYPT_ROUNDS,
	checkRateLimit,
	clearRateLimit,
	getClientIp,
	LOGIN_RATE_LIMIT_ATTEMPTS,
	LOGIN_RATE_LIMIT_WINDOW_MS,
	parseBody,
	badRequest,
	ok,
} from "@store/shared";

import { invalidateSessionCache } from "@/lib/permissions";

const RESET_PASSWORD_RATE_LIMIT_SCOPE = "admin:reset-password";
const MS_PER_SECOND = 1000;

interface ResetPasswordBody {
	token?: unknown;
	password?: unknown;
}

export async function POST(request: Request) {
	const parsed = await parseBody<ResetPasswordBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}

	const { token, password } = parsed;

	if (!token || typeof token !== "string") {
		return badRequest("Invalid or missing token.");
	}

	// Rate limit the token submission attempt to prevent brute-forcing tokens
	const ip = getClientIp(request);
	const rateLimitKey = `${ip}`; // Rate limit by IP for reset attempts
	const rateLimit = checkRateLimit({
		scope: RESET_PASSWORD_RATE_LIMIT_SCOPE,
		key: rateLimitKey,
		max: LOGIN_RATE_LIMIT_ATTEMPTS,
		windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
	});

	if (!rateLimit.isAllowed) {
		logger.warn({ ip, retryAfterMs: rateLimit.retryAfterMs }, "Admin reset password rate limit exceeded");
		return NextResponse.json(
			{ error: "Too many attempts. Please try again later." },
			{ status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / MS_PER_SECOND)) } },
		);
	}

	const validationResult = validatePassword(password);
	if (isValidationError(validationResult)) {
		return badRequest(validationResult.error);
	}

	try {
		// Hash the incoming raw token to compare with the DB stored hashed token
		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

		await connectDB();

		// Find a user with this token and ensure the token hasn't expired
		const user = await User.findOne({
			resetPasswordToken: hashedToken,
			resetPasswordExpiresAt: { $gt: new Date() },
			isActive: true,
		});

		if (!user) {
			logger.warn("Password reset attempt with invalid or expired token");
			return badRequest("This password reset link is invalid or has expired. Please request a new one.");
		}

		// Update password
		const passwordHash = await bcrypt.hash(validationResult, BCRYPT_ROUNDS);
		user.passwordHash = passwordHash;
		user.passwordChangedAt = new Date();

		// Invalidate the token so it can't be used again
		user.resetPasswordToken = undefined;
		user.resetPasswordExpiresAt = undefined;

		await user.save();

		invalidateSessionCache(String(user._id));

		clearRateLimit(RESET_PASSWORD_RATE_LIMIT_SCOPE, rateLimitKey);

		logger.info({ userId: String(user.id) }, "User password successfully reset via token");

		return ok({ message: "Password updated successfully." });
	} catch (error) {
		return handleMongoError(error);
	}
}
