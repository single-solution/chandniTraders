import bcrypt from "bcryptjs";
import { badRequest, BCRYPT_ROUNDS, FIELD_LIMITS, isValidationError, ok, parseBody, validateEmail, validatePassword, validateString } from "@store/shared";
import { connectDB, handleMongoError, User } from "@store/db";

import { requireSession } from "@/lib/api/requireSession";
import { invalidateSessionCache } from "@/lib/permissions";
import { toUserResponse, type UserLean } from "@/lib/serializers/user";

export async function GET() {
	const { actor, response } = await requireSession();
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const doc = await User.findById(actor.id).lean<UserLean>();
		if (!doc) {
			return badRequest("Account not found.");
		}

		return ok(toUserResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

interface AccountUpdateInput {
	name?: unknown;
	email?: unknown;
	phoneNumber?: unknown;
	password?: unknown;
}

export async function PUT(request: Request) {
	const { actor, response } = await requireSession();
	if (response) {
		return response;
	}

	const body = await parseBody<AccountUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};

	if (body.name !== undefined) {
		const result = validateString(body.name, {
			label: "Name",
			max: FIELD_LIMITS.shortText,
		});
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.name = result;
	}
	if (body.email !== undefined) {
		const result = validateEmail(body.email);
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.email = result;
	}
	if (body.phoneNumber !== undefined) {
		update.phoneNumber = typeof body.phoneNumber === "string" && body.phoneNumber.trim().length > 0 ? body.phoneNumber.trim().slice(0, FIELD_LIMITS.phoneNumber) : undefined;
	}
	if (body.password !== undefined) {
		const result = validatePassword(body.password);
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.passwordHash = await bcrypt.hash(result, BCRYPT_ROUNDS);
		update.passwordChangedAt = new Date();
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const doc = await User.findByIdAndUpdate(actor.id, { $set: update }, { new: true, runValidators: true }).lean<UserLean>();
		if (!doc) {
			return badRequest("Account not found.");
		}

		invalidateSessionCache(actor.id);
		return ok(toUserResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}
