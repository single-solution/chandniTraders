import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	/**
	 * Storefront sessions only ever represent a `customer`. The admin app has a
	 * different session shape and runs in a different bundle.
	 */
	interface Session {
		user: {
			id: string;
			role: "customer";
			phoneNumber?: string;
			customerId?: string;
		} & DefaultSession["user"];
	}

	interface User {
		role: "customer";
		phoneNumber?: string;
		customerId?: string;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		role: "customer";
		phoneNumber?: string;
		customerId?: string;
	}
}
