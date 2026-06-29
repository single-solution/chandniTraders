import { redirect } from "next/navigation";

import { getActorPermissions, getVerifiedSession, hasPermission, type VerifiedUser } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissionsCatalog";

/**
 * Server-component guard for admin pages. If the visitor is unauthenticated
 * (or their backing user record was deactivated/deleted), redirects to the
 * login page with a `callbackUrl` so they land back on the page after sign-in.
 */
export async function requirePageSession(callbackPath: string): Promise<VerifiedUser> {
	const actor = await getVerifiedSession();
	if (!actor) {
		const callback = encodeURIComponent(callbackPath);
		redirect(`/login?callbackUrl=${callback}`);
	}
	return actor;
}

export interface PageAccess {
	actor: VerifiedUser;
	permissions: PermissionKey[];
}

/**
 * Like {@link requirePageSession} but also requires a specific permission.
 * Users without access are sent to the dashboard.
 */
export async function requirePagePermission(permission: PermissionKey, callbackPath: string): Promise<PageAccess> {
	const actor = await requirePageSession(callbackPath);
	if (!hasPermission(actor, permission)) {
		redirect("/?access=denied");
	}
	return {
		actor,
		permissions: getActorPermissions(actor),
	};
}
