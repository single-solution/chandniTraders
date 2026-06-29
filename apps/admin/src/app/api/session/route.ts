import { ok } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { getActorPermissions } from "@/lib/permissions";

/** Lightweight session payload for client-side permission gating. */
export async function GET() {
	const { actor, response } = await requireSession();
	if (response) {
		return response;
	}

	return ok({
		id: actor.id,
		name: actor.name,
		email: actor.email,
		role: actor.role,
		isSuperAdmin: actor.isSuperAdmin,
		permissions: getActorPermissions(actor),
	});
}
