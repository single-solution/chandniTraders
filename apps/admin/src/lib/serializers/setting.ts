import type { Types } from "mongoose";
import type { AdminSetting } from "@/types/models";
import { asString, objectIdString, toIsoDate } from "@store/shared";

export interface SettingLean {
	_id: Types.ObjectId;
	key: string;
	value: unknown;
	description?: string;
	group?: string;
	updatedBy?: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export function toSettingResponse(doc: SettingLean): AdminSetting {
	return {
		id: objectIdString(doc._id),
		key: asString(doc.key),
		value: doc.value,
		description: doc.description,
		group: doc.group,
		updatedById: objectIdString(doc.updatedBy) || undefined,
		createdAt: toIsoDate(doc.createdAt),
		updatedAt: toIsoDate(doc.updatedAt),
	};
}
