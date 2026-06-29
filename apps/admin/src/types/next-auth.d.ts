import type { DefaultSession } from "next-auth";

type AdminRole = "owner" | "business_manager" | "product_manager" | "marketing_manager" | "support_staff";

declare module "next-auth" {
	/**
	 * Admin sessions only ever represent an admin user. Customer sessions
	 * cannot reach this app — they live in a different bundle on a different
	 * cookie name — but the union below excludes `customer` defensively too.
	 */
	interface Session {
		user: {
			id: string;
			role: AdminRole;
			isSuperAdmin: boolean;
			passwordChangedAtMs: number;
		} & DefaultSession["user"];
	}

	interface User {
		role: AdminRole;
		isSuperAdmin: boolean;
		passwordChangedAtMs?: number;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		role: AdminRole;
		isSuperAdmin: boolean;
		passwordChangedAtMs?: number;
	}
}
