/**
 * POST /api/chat/anonymous-threads
 *
 * Opens a guest preview thread — no name, phone, or first message required.
 * The browser gets an anonymous id cookie; up to CHAT_GUEST_MESSAGE_LIMIT
 * customer messages are allowed before sign-in. Replaces the previous
 * `/chat/start-anonymous` verb URL.
 */

import { cookies } from "next/headers";

import { Inquiry as InquiryModel, connectDB } from "@store/db";
import { appendInquiryToGuestToken, badRequest, created, logger, resolveChatWelcomeMessage, serverError } from "@store/shared";

import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { auth } from "@/lib/auth";
import { getChatSettings } from "@/lib/chat/chatSettings";
import { anonymousChatPhone, getOrCreateAnonymousChatId } from "@/lib/chat/anonymousSession";
import { toThreadLatestPage } from "@/lib/chat/serializer";
import type { InquiryLean } from "@/lib/chat/serializer";

const COOKIE_NAME = "inquiry_thread_token";
const MAX_ANON_STARTS_PER_WINDOW = 5;

interface CreateAnonymousThreadBody {
	subjectProductId?: unknown;
	subjectProductName?: unknown;
}

export async function POST(request: Request) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const limited = enforcePublicRateLimit(request, {
		scope: "chat-start-anonymous",
		max: MAX_ANON_STARTS_PER_WINDOW,
	});
	if (limited) {
		return limited;
	}

	const settings = await getChatSettings();
	if (!settings.enabled) {
		return badRequest("Chat is currently disabled.");
	}

	let subjectProductId: string | undefined;
	let subjectProductName: string | undefined;
	try {
		const body = (await request.json()) as CreateAnonymousThreadBody;
		if (typeof body.subjectProductId === "string") {
			const trimmed = body.subjectProductId.trim();
			if (trimmed) {
				subjectProductId = trimmed.slice(0, 64);
			}
		}
		if (typeof body.subjectProductName === "string") {
			const trimmed = body.subjectProductName.trim();
			if (trimmed) {
				subjectProductName = trimmed.slice(0, 200);
			}
		}
	} catch {
		// empty body is fine
	}

	const session = await auth();
	if (session?.user?.role === "customer") {
		return badRequest("Signed-in customers should use their existing threads.");
	}

	await connectDB();
	try {
		const anonId = await getOrCreateAnonymousChatId();
		const phoneNumber = anonymousChatPhone(anonId);
		const now = new Date();
		const welcome = resolveChatWelcomeMessage({
			audience: "guest",
			settings,
			guestMessageLimit: settings.guestMessageLimit,
		});

		const doc = await InquiryModel.create({
			customerName: "Guest",
			phoneNumber,
			status: "open",
			lastMessageAt: now,
			lastMessagePreview: welcome.slice(0, 280),
			lastMessageAuthor: "assistant",
			unreadByCustomer: 0,
			unreadByTeam: 0,
			subjectProductId,
			subjectProductName,
			messages: [],
		});

		const lean = await InquiryModel.findById(doc._id).lean<InquiryLean>();
		if (!lean) {
			return serverError("Thread vanished after creation.");
		}

		const thread = toThreadLatestPage(lean);
		const cookieJar = await cookies();
		const existing = cookieJar.get(COOKIE_NAME)?.value;
		const reissued = await appendInquiryToGuestToken(existing, thread.id, phoneNumber, { days: settings.guestThreadTokenDays });
		cookieJar.set({
			name: COOKIE_NAME,
			value: reissued.token,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: reissued.maxAgeSeconds,
		});

		return created(thread);
	} catch (error) {
		logger.error({ error }, "Failed to start anonymous chat thread");
		return serverError("Could not start chat. Please try again.");
	}
}
