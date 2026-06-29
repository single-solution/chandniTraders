import mongoose, { Schema, type Model } from "mongoose";

interface SettingAttributes {
	key: string;
	value: unknown;
	description?: string;
	group?: string;
	updatedBy?: mongoose.Types.ObjectId;
}

const SETTING_KEY_MAX_LENGTH = 160;
const SETTING_DESC_MAX_LENGTH = 600;
const SETTING_GROUP_MAX_LENGTH = 80;

const settingSchema = new Schema<SettingAttributes>(
	{
		key: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			maxlength: SETTING_KEY_MAX_LENGTH,
			index: true,
		},
		value: { type: Schema.Types.Mixed, required: true },
		description: { type: String, trim: true, maxlength: SETTING_DESC_MAX_LENGTH },
		group: { type: String, trim: true, maxlength: SETTING_GROUP_MAX_LENGTH, index: true },
		updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true },
);

export const Setting: Model<SettingAttributes> = (mongoose.models.Setting as Model<SettingAttributes>) ?? mongoose.model<SettingAttributes>("Setting", settingSchema);
