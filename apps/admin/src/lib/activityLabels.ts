import type { AdminActivityResourceType } from "@/types/models";

/** Human-readable labels for {@link AdminActivityEntry} `action` values. */
export const ACTIVITY_ACTION_LABEL: Record<string, string> = {
	created: "Created",
	updated: "Updated",
	deleted: "Deleted",
	archived: "Archived",
	restored: "Restored",
	status_changed: "Status changed",
	login: "Signed in",
	logout: "Signed out",
	invited: "Invited",
	signin_code_issued: "Sign-in code issued",
};

export function formatActivityAction(action: string): string {
	return ACTIVITY_ACTION_LABEL[action] ?? action.replace(/_/g, " ");
}

export function resolveResourceUrl(type: AdminActivityResourceType, id?: string): string | null {
	if (!id) return null;
	switch (type) {
		case "order":
			return `/orders?order=${id}`;
		case "customer":
			return `/customers?customer=${id}`;
		case "product":
			return `/products?product=${id}`;
		case "team":
			return `/team?member=${id}`;
		case "inquiry":
			return `/inquiries?inquiry=${id}`;
		case "loyalty":
			return `/settings?tab=loyalty`;
		case "settings":
			return `/settings?tab=${id}`;
		case "offer":
			return `/offers`;
		case "brand":
		case "category":
		case "attribute":
			return `/categories`;
		default:
			return null;
	}
}
