import { ActivityEntry, type ActivityAction, type ActivityResourceType } from "@store/db";
import type { VerifiedUser } from "@/lib/permissions";
import { logger } from "@store/shared";

interface RecordActivityInput {
	actor: VerifiedUser;
	action: ActivityAction;
	resourceType: ActivityResourceType;
	resourceId?: string;
	resourceLabel: string;
	detail?: string;
}

/**
 * Append a single audit-log entry. Failures are logged but never thrown — an
 * activity-log write should not break a successful business operation.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
	try {
		await ActivityEntry.create({
			actorUserId: input.actor.id,
			actorName: input.actor.name,
			actorRole: input.actor.isSuperAdmin ? "owner" : input.actor.role,
			action: input.action,
			resourceType: input.resourceType,
			resourceId: input.resourceId,
			resourceLabel: input.resourceLabel,
			detail: input.detail,
		});
	} catch (error) {
		logger.error({ error, input }, "Failed to write activity log entry");
	}
}
