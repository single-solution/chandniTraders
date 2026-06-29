import bcrypt from "bcryptjs";
import {
	badRequest,
	BCRYPT_ROUNDS,
	conflict,
	FIELD_LIMITS,
	forbidden,
	isValidationError,
	isValidId,
	noContent,
	notFound,
	ok,
	parseBody,
	validateEmail,
	validatePassword,
	validateString,
} from "@store/shared";
import { connectDB, handleMongoError, User, USER_ROLES, type UserRole } from "@store/db";

import { requireSession } from "@/lib/api/requireSession";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";

import { invalidateSessionCache } from "@/lib/permissions";
import { toUserResponse, type UserLean } from "@/lib/serializers/user";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("team_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	try {
		await connectDB();
		const doc = await User.findById(id).lean<UserLean>();
		if (!doc) {
			return notFound("User not found");
		}

		return ok(toUserResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

interface UserUpdateInput {
	name?: unknown;
	email?: unknown;
	phoneNumber?: unknown;
	password?: unknown;
	role?: unknown;
	isActive?: unknown;
	isSuperAdmin?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("team_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<UserUpdateInput>(request);
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
	// Block privilege-escalation paths: a user cannot elevate themselves, and
	// role/super-admin changes require super-admin authority. Self-deactivation
	// is also banned so the last admin can't lock the team out.
	const isSelfEdit = id === actor.id;
	if (body.role !== undefined) {
		if (typeof body.role !== "string" || !(USER_ROLES as readonly string[]).includes(body.role)) {
			return badRequest("Invalid role.");
		}
		if (isSelfEdit) {
			return forbidden("You cannot change your own role.");
		}
		if (!actor.isSuperAdmin) {
			return forbidden("Only super admins can change roles.");
		}
		update.role = body.role as UserRole;
	}
	if (body.isActive !== undefined) {
		if (isSelfEdit && body.isActive === false) {
			return forbidden("You cannot deactivate your own account.");
		}
		update.isActive = Boolean(body.isActive);
	}
	if (body.isSuperAdmin !== undefined) {
		if (!actor.isSuperAdmin) {
			return forbidden("Only super admins can change super-admin status.");
		}
		if (isSelfEdit && body.isSuperAdmin === false) {
			return forbidden("You cannot revoke your own super-admin status.");
		}
		update.isSuperAdmin = Boolean(body.isSuperAdmin);
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
		const doc = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean<UserLean>();
		if (!doc) {
			return notFound("User not found");
		}

		// Drop the cached session so a role/active/password change is reflected
		// on this user's very next request (security.md § Session Enrichment).
		invalidateSessionCache(id);

		void recordActivity({
			actor,
			action: "updated",
			resourceType: "team",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return ok(toUserResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("team_remove");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	if (id === actor.id) {
		return conflict("You cannot remove your own account.");
	}

	await connectDB();
	try {
		const doc = await User.findById(id).lean<UserLean>();
		if (!doc) {
			return notFound("User not found");
		}

		const MIN_OWNERS_ALLOWED = 1;
		if (doc.isSuperAdmin) {
			const owners = await User.countDocuments({ isSuperAdmin: true });
			if (owners <= MIN_OWNERS_ALLOWED) {
				return conflict("Cannot remove the last super admin.");
			}
		}

		await User.findByIdAndDelete(id);
		invalidateSessionCache(id);

		void recordActivity({
			actor,
			action: "deleted",
			resourceType: "team",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
