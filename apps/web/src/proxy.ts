import NextAuth from "next-auth";
import { authConfig } from "@/lib/authConfig";

/**
 * Edge proxy for the storefront.
 *
 * Renamed from `middleware.ts` in Next 16 (the old name is now deprecated).
 * Same matcher, same Auth.js integration — only the filename changed.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|js|woff2?|ttf)).*)"],
};
