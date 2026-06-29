import type { UserRole } from "@store/db";

import { ROLE_PERMISSIONS, type PermissionKey } from "./permissionsCatalog";

/**
 * Static catalog of human-readable role and permission metadata used by the
 * Team workspace. The actual role → permission matrix is sourced from
 * {@link ROLE_PERMISSIONS} so this file only adds copy and grouping for the
 * UI — it never alters access control.
 */

export const ROLE_LABEL: Record<UserRole, string> = {
	owner: "Owner",
	business_manager: "Business manager",
	product_manager: "Product manager",
	marketing_manager: "Marketing manager",
	support_staff: "Support staff",
};

export const ROLE_TAGLINE: Record<UserRole, string> = {
	owner: "Full access · runs the business",
	business_manager: "Day-to-day operations lead",
	product_manager: "Catalog & merchandising",
	marketing_manager: "Offers & content",
	support_staff: "Customer-facing read & chat",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
	owner:
		"Top-level access. Owners can do everything in the admin — including managing the team and running destructive cleanup tools. Reserve this for the people who actually run the business.",
	business_manager: "Day-to-day operations lead. Manages products, orders, customers, loyalty, chats, and store settings. Cannot manage the team or run destructive data cleanup.",
	product_manager: "Catalog focus. Creates and edits products, categories, brands, and media. Does not see orders, customers, settings, or chat.",
	marketing_manager: "Promotions & merchandising. Manages offers, categories, brands, and media. Cannot edit individual products, orders, or customers.",
	support_staff: "Customer-facing read access plus the ability to reply to chats. Cannot edit orders, products, or settings.",
};

export const ROLE_TONE: Record<UserRole, "success" | "accent" | "info" | "neutral"> = {
	owner: "success",
	business_manager: "accent",
	product_manager: "info",
	marketing_manager: "accent",
	support_staff: "neutral",
};

export const ROLE_ORDER: UserRole[] = ["owner", "business_manager", "product_manager", "marketing_manager", "support_staff"];

export const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
	value: role,
	label: ROLE_LABEL[role],
}));

export const PERMISSION_LABEL: Record<PermissionKey, string> = {
	product_view: "View products",
	product_create: "Create products",
	product_update: "Edit products",
	product_delete: "Delete products",

	order_view: "View orders",
	order_update: "Update order status",
	order_cancel: "Cancel orders",
	order_refund: "Issue refunds",
	order_delete: "Delete orders",

	customer_view: "View customers",
	customer_update: "Edit customer profiles",
	customer_manage: "Manage customers (notes, delete)",

	loyalty_view: "View loyalty balances",
	loyalty_manage: "Adjust loyalty points",

	inquiry_view: "View customer chats",
	inquiry_reply: "Reply to chats",
	inquiry_manage: "Close, reassign, archive chats",

	category_manage: "Manage categories",
	brand_manage: "Manage brands",
	offer_manage: "Manage offers & promotions",

	media_view: "Browse media library",
	media_upload: "Upload media",
	media_delete: "Delete from media library",

	settings_view: "View store settings",
	settings_update: "Edit store settings",

	team_view: "View team",
	team_invite: "Invite team members",
	team_update: "Edit team members",
	team_remove: "Remove team members",

	activity_view: "Read activity log",
	ai_view: "Use AI tools",

	data_cleanup: "Run destructive data cleanup",
};

export interface PermissionGroup {
	id: string;
	label: string;
	description: string;
	permissions: PermissionKey[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
	{
		id: "catalog",
		label: "Products & catalog",
		description: "Products, categories, brands, and storefront merchandising.",
		permissions: ["product_view", "product_create", "product_update", "product_delete", "category_manage", "brand_manage", "offer_manage"],
	},
	{
		id: "orders",
		label: "Orders",
		description: "Order lifecycle from confirmation through refunds.",
		permissions: ["order_view", "order_update", "order_cancel", "order_refund", "order_delete"],
	},
	{
		id: "customers",
		label: "Customers & loyalty",
		description: "Customer profiles, addresses, internal notes, and points.",
		permissions: ["customer_view", "customer_update", "customer_manage", "loyalty_view", "loyalty_manage"],
	},
	{
		id: "chats",
		label: "Chats & inquiries",
		description: "Storefront chat threads opened by customers.",
		permissions: ["inquiry_view", "inquiry_reply", "inquiry_manage"],
	},
	{
		id: "media",
		label: "Media library",
		description: "Image uploads used across products, offers, and pages.",
		permissions: ["media_view", "media_upload", "media_delete"],
	},
	{
		id: "settings",
		label: "Store settings",
		description: "Branding, payments, shipping, integrations, and cleanup tools.",
		permissions: ["settings_view", "settings_update", "data_cleanup"],
	},
	{
		id: "team",
		label: "Team management",
		description: "Inviting, editing, and removing admin accounts.",
		permissions: ["team_view", "team_invite", "team_update", "team_remove"],
	},
	{
		id: "observability",
		label: "Activity & AI tools",
		description: "Audit log and AI assistant features.",
		permissions: ["activity_view", "ai_view"],
	},
];

/**
 * Effective permission count for a role, used in the UI to summarise scope
 * (e.g. "Has 23 of 38 permissions").
 */
export function rolePermissionCount(role: UserRole): number {
	return ROLE_PERMISSIONS[role].length;
}
