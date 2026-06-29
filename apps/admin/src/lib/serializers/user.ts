import type { Types } from "mongoose";
import type { AdminUser } from "@/types/models";
import type { UserRole } from "@store/db";
import { asString, objectIdString, toIsoDate } from "@store/shared";

export interface UserLean {
	_id: Types.ObjectId;
	email: string;
	name: string;
	phoneNumber?: string;
	role: UserRole;
	isActive: boolean;
	isSuperAdmin: boolean;
	lastLoginAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export function toUserResponse(doc: UserLean): AdminUser {
	return {
		id: objectIdString(doc._id),
		name: asString(doc.name),
		email: asString(doc.email),
		phoneNumber: doc.phoneNumber,
		role: doc.role,
		isSuperAdmin: doc.isSuperAdmin ?? false,
		isActive: doc.isActive ?? true,
		lastSignInAt: doc.lastLoginAt ? toIsoDate(doc.lastLoginAt) : undefined,
		createdAt: toIsoDate(doc.createdAt),
		updatedAt: toIsoDate(doc.updatedAt),
	};
}
