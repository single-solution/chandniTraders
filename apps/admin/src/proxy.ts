import NextAuth from "next-auth";
import { authConfig } from "@/lib/authConfig";

/**
 * Edge proxy for the admin app.
 *
 * Renamed from `middleware.ts` in Next 16 (the old name is now deprecated).
 * Same matcher, same Auth.js integration — only the filename changed.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)).*)"],
};
