import { cookies } from "next/headers";

import { signOut } from "@/lib/auth";
import { CHAT_ANON_ID_COOKIE } from "@/lib/chat/anonymousSession";

const INQUIRY_THREAD_TOKEN_COOKIE = "inquiry_thread_token";

/**
 * Server-side sign-out endpoint.
 *
 * Two callers:
 *   - The explicit "Sign out" button (passes `?to=/`).
 *   - Account pages whose JWT is valid but whose `Customer` is gone — they
 *     can't clear the cookie during render, so they redirect here to avoid a
 *     loop with the middleware.
 *
 * Besides ending the NextAuth session it clears the httpOnly chat cookies so a
 * shared device can't resume the previous visitor's guest conversation.
 */
export async function GET(request: Request) {
	const cookieStore = await cookies();
	cookieStore.delete(CHAT_ANON_ID_COOKIE);
	cookieStore.delete(INQUIRY_THREAD_TOKEN_COOKIE);

	const requested = new URL(request.url).searchParams.get("to");
	// `to` is user-controlled — only honour same-origin paths.
	const redirectTo = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/account/sign-in";

	await signOut({ redirectTo });
}
