import { cache } from "react";

import { User, connectDB, type UserRole } from "@store/db";
import { SESSION_CACHE_TTL_MS, logger } from "@store/shared";

import { auth } from "@/lib/auth";
import { ROLE_PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from "@/lib/permissionsCatalog";

/**
 * Authenticated actor enriched with current DB state. Returned by
 * `getVerifiedSession()`. Routes should always pass this to permission checks
 * — never read claims off the JWT directly.
 */
export interface VerifiedUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	isSuperAdmin: boolean;
	isActive: boolean;
}

interface CacheEntry {
	user: VerifiedUser;
	cachedAt: number;
}

/**
 * Process-local enrichment cache. JWT verification is fast; the DB round-trip
 * for `findById` is what we save. TTL is intentionally short so role/active
 * changes propagate within a few requests (security.md § Session Enrichment).
 *
 * Note: in a multi-instance deployment each pod has its own cache — that's
 * acceptable because `SESSION_CACHE_TTL_MS` is short. For instant
 * invalidation, swap this for Redis with the same key shape.
 */
const sessionCache = new Map<string, CacheEntry>();

/** Drop a single user's cached session — call after role/active changes. */
export function invalidateSessionCache(userId: string): void {
	sessionCache.delete(userId);
}

/**
 * Verify the caller's session and re-load the user from the database. The
 * JWT proves identity; the DB lookup proves current state (active flag, role,
 * super-admin status) so a session that pre-dates a role change can't keep
 * acting on stale claims.
 *
 * Two layers of dedupe:
 *   1. React `cache()` — collapses every call inside a single RSC render so a
 *      page (e.g. the dashboard with `requirePagePermission` + an async hub
 *      section that re-checks) pays for `auth()` exactly once per request.
 *   2. Process-local `sessionCache` — survives across requests for
 *      {@link SESSION_CACHE_TTL_MS} so the JWT-verified user only round-trips
 *      to Mongo when the TTL expires.
 */
export const getVerifiedSession = cache(getVerifiedSessionUncached);

async function getVerifiedSessionUncached(): Promise<VerifiedUser | null> {
	const session = await auth();
	if (!session?.user?.id) {
		return null;
	}

	const userId = session.user.id;
	const cached = sessionCache.get(userId);
	if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
		return cached.user;
	}

	await connectDB();
	const user = await User.findById(userId).select({ email: 1, name: 1, role: 1, isSuperAdmin: 1, isActive: 1, passwordChangedAt: 1 }).lean();
	if (!user || user.isActive === false) {
		sessionCache.delete(userId);
		logger.info({ userId }, "Session rejected: user not found or inactive");
		return null;
	}

	const sessionChangedAt = session.user.passwordChangedAtMs ?? 0;
	const dbChangedAt = user.passwordChangedAt?.getTime() ?? 0;
	if (dbChangedAt > sessionChangedAt) {
		sessionCache.delete(userId);
		logger.info({ userId }, "Session rejected: password changed since login");
		return null;
	}

	const verified: VerifiedUser = {
		id: String(user._id),
		email: user.email,
		name: user.name,
		role: user.role,
		isSuperAdmin: user.isSuperAdmin === true,
		isActive: user.isActive,
	};
	sessionCache.set(userId, { user: verified, cachedAt: Date.now() });
	return verified;
}

/** Whether `actor` holds `permission`. Super-admins implicitly hold every key. */
export function hasPermission(actor: VerifiedUser, permission: PermissionKey): boolean {
	if (actor.isSuperAdmin) {
		return true;
	}
	const allowed = expandRolePermissions(ROLE_PERMISSIONS[actor.role] ?? []);
	return allowed.has(permission);
}

/** All permission keys granted to an actor (including implied keys). */
export function getActorPermissions(actor: VerifiedUser): PermissionKey[] {
	if (actor.isSuperAdmin) {
		return [...PERMISSION_KEYS];
	}
	return [...expandRolePermissions(ROLE_PERMISSIONS[actor.role] ?? [])];
}

function expandRolePermissions(keys: ReadonlyArray<PermissionKey>): Set<PermissionKey> {
	const allowed = new Set<PermissionKey>(keys);
	if (allowed.has("inquiry_manage")) {
		allowed.add("inquiry_reply");
		allowed.add("inquiry_view");
	}
	if (allowed.has("inquiry_reply")) {
		allowed.add("inquiry_view");
	}
	return allowed;
}
