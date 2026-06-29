import type { UserRole } from "@store/db";

/**
 * Static catalog of permission keys, the role → keys matrix, and the JWT
 * claim shape. The file is intentionally framework- and DB-free so it can
 * be imported by middleware (Edge runtime) without pulling in Mongoose.
 *
 * Routes and UI both reference `PermissionKey` so renaming a key surfaces
 * every call site at compile time.
 */
const PERMISSION_KEYS = [
	"product_view",
	"product_create",
	"product_update",
	"product_delete",

	"order_view",
	"order_update",
	"order_cancel",
	"order_refund",
	"order_delete",

	"customer_view",
	"customer_update",
	"customer_manage",

	"loyalty_view",
	"loyalty_manage",

	"inquiry_view",
	"inquiry_reply",
	"inquiry_manage",

	"category_manage",
	"brand_manage",
	"offer_manage",

	"media_view",
	"media_upload",
	"media_delete",

	"settings_view",
	"settings_update",

	"team_view",
	"team_invite",
	"team_update",
	"team_remove",

	"activity_view",
	"ai_view",

	// Destructive bulk-data tooling lives behind its own permission so it
	// can't be accidentally granted to a manager via permission inheritance.
	"data_cleanup",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export { PERMISSION_KEYS };

/**
 * Default role → permissions mapping. Owners get every permission via
 * `isSuperAdmin = true`, so this matrix only matters for managers and staff.
 *
 * Override per-user via the User document's optional `permissions` field
 * (added in a later stage); until then, role drives everything.
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlyArray<PermissionKey>> = {
	owner: PERMISSION_KEYS,
	business_manager: [
		"product_view",
		"product_create",
		"product_update",
		"product_delete",
		"order_view",
		"order_update",
		"order_cancel",
		"order_refund",
		"customer_view",
		"customer_manage",
		"loyalty_view",
		"loyalty_manage",
		"inquiry_manage",
		"category_manage",
		"brand_manage",
		"offer_manage",
		"media_view",
		"media_upload",
		"settings_view",
		"settings_update",
		"team_view",
		"activity_view",
		"ai_view",
	],
	product_manager: [
		"product_view",
		"product_create",
		"product_update",
		"product_delete",
		"category_manage",
		"brand_manage",
		"media_view",
		"media_upload",
		"media_delete",
		"activity_view",
		"ai_view",
	],
	marketing_manager: ["product_view", "offer_manage", "category_manage", "brand_manage", "media_view", "media_upload", "media_delete", "activity_view", "ai_view"],
	support_staff: ["product_view", "order_view", "customer_view", "inquiry_view", "inquiry_reply", "media_view", "ai_view"],
};
