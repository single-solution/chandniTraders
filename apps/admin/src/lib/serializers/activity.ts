import type { Types } from "mongoose";
import type { AdminActivityEntry } from "@/types/models";
import type { ActivityAction, ActivityResourceType } from "@store/db";
import { asString, objectIdString, toIsoDate } from "@store/shared";

export interface ActivityEntryLean {
	_id: Types.ObjectId;
	actorUserId?: Types.ObjectId;
	actorName: string;
	actorRole: string;
	action: ActivityAction;
	resourceType: ActivityResourceType;
	resourceId?: string;
	resourceLabel: string;
	detail?: string;
	createdAt: Date;
	updatedAt: Date;
}

export function toActivityResponse(doc: ActivityEntryLean): AdminActivityEntry {
	return {
		id: objectIdString(doc?._id),
		actorUserId: objectIdString(doc?.actorUserId) || undefined,
		actorName: asString(doc?.actorName, "System"),
		actorRole: asString(doc?.actorRole),
		action: doc?.action,
		resourceType: doc?.resourceType,
		resourceId: doc?.resourceId,
		resourceLabel: asString(doc?.resourceLabel),
		detail: doc?.detail,
		createdAt: toIsoDate(doc?.createdAt),
		updatedAt: toIsoDate(doc?.updatedAt),
	};
}
