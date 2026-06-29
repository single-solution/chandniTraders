import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const CHAT_ANON_ID_COOKIE = "chat_anon_id";

export function anonymousChatPhone(anonId: string): string {
	return `anon:${anonId}`;
}

export async function getOrCreateAnonymousChatId(): Promise<string> {
	const cookieJar = await cookies();
	const existing = cookieJar.get(CHAT_ANON_ID_COOKIE)?.value?.trim();
	if (existing && existing.length >= 8 && existing.length <= 64) {
		return existing;
	}

	const anonId = randomUUID();
	cookieJar.set({
		name: CHAT_ANON_ID_COOKIE,
		value: anonId,
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
	});
	return anonId;
}
