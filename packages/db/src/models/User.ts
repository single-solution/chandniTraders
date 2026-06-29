import mongoose, { Schema, type Model } from "mongoose";

/**
 * Roles available in the admin console. Permissions per role are
 * resolved in `apps/admin/src/lib/permissions.ts`.
 */
export const USER_ROLES = ["owner", "business_manager", "product_manager", "marketing_manager", "support_staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

interface UserAttributes {
	email: string;
	passwordHash: string;
	name: string;
	phoneNumber?: string;
	role: UserRole;
	isActive: boolean;
	isSuperAdmin: boolean;
	lastLoginAt?: Date;
	passwordChangedAt?: Date;
	resetPasswordToken?: string;
	resetPasswordExpiresAt?: Date;
}

const USER_NAME_MAX_LENGTH = 200;
const USER_PHONE_MAX_LENGTH = 32;

const userSchema = new Schema<UserAttributes>(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			index: true,
		},
		passwordHash: {
			type: String,
			required: true,
			select: false,
		},
		name: {
			type: String,
			required: true,
			trim: true,
			maxlength: USER_NAME_MAX_LENGTH,
		},
		phoneNumber: {
			type: String,
			trim: true,
			maxlength: USER_PHONE_MAX_LENGTH,
		},
		role: {
			type: String,
			enum: USER_ROLES,
			required: true,
			default: "support_staff",
		},
		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},
		isSuperAdmin: {
			type: Boolean,
			required: true,
			default: false,
		},
		lastLoginAt: { type: Date },
		passwordChangedAt: { type: Date },
		resetPasswordToken: { type: String, select: false },
		resetPasswordExpiresAt: { type: Date },
	},
	{ timestamps: true },
);

export const User: Model<UserAttributes> = (mongoose.models.User as Model<UserAttributes>) ?? mongoose.model<UserAttributes>("User", userSchema);
