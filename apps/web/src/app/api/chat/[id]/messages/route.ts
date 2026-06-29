/**
 * POST /api/chat/[id]/messages
 *
 * Customer sends a new message into an existing thread. Access is
 * gated by `resolveChatAccess` — only the signed-in owner or the
 * matching guest cookie can post.
 *
 * Side effects on the inquiry doc:
 *   - `messages` ← push new entry (`author: "customer"`).
 *   - `lastMessageAt` / `lastMessagePreview` / `lastMessageAuthor`
 *     refreshed so the admin inbox sort surfaces the activity.
 *   - `unreadByTeam` += 1 (admin acks reset this on read).
 *   - `unreadByCustomer` reset to 0 (we just round-tripped).
 *   - `status` flipped to `open` when it was `resolved` so the team
 *     sees it back in the active queue.
 */

import { Inquiry as InquiryModel, connectDB, getStoreSettings, getIntegrationSettings, resolveInquiryStaffNotifyTargets } from "@store/db";
import {
	badRequest,
	CHAT_MESSAGE_BODY_MAX,
	created,
	guestChatLoginRequired,
	isFieldError,
	logger,
	parseBody,
	serverError,
	SHORT_BURST_WINDOW_MS,
	validateMessageBody,
} from "@store/shared";
import { notifyStaffOnCustomerMessage } from "@store/shared/server";

import { auth } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { inquiryStatusPatchAfterMessage } from "@store/shared";
import { getChatSettings } from "@/lib/chat/chatSettings";

import { resolveChatAccess } from "@/lib/chat/access";
import { claimAnonymousThreadIfNeeded } from "@/lib/chat/claimAnonymousThread";
import { maybeReplyWithAssistant, reloadInquiry } from "@/lib/chat/assistant/maybeReply";
import { toThreadLatestPage } from "@/lib/chat/serializer";
import type { InquiryLean } from "@/lib/chat/serializer";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface PostBody {
	body?: unknown;
	subjectProductId?: unknown;
	subjectProductName?: unknown;
}

const MAX_PER_WINDOW = 30;

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: RouteContext) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const { id } = await params;
	const access = await resolveChatAccess(id);
	if (access instanceof Response) return access;

	const limited = enforcePublicRateLimit(request, {
		scope: "chat-message",
		identifier: access.inquiry.phoneNumber,
		max: MAX_PER_WINDOW,
		windowMs: SHORT_BURST_WINDOW_MS,
	});
	if (limited) return limited;

	const session = await auth();
	const settings = await getChatSettings();

	const parsed = await parseBody<PostBody>(request);
	if (parsed instanceof Response) return parsed;

	const bodyResult = validateMessageBody(parsed.body);
	if (isFieldError(bodyResult)) {
		return badRequest(bodyResult.error);
	}
	if (bodyResult.length > CHAT_MESSAGE_BODY_MAX) {
		return badRequest("Message too long.");
	}

	let subjectProductId: string | undefined;
	let subjectProductName: string | undefined;
	if (typeof parsed.subjectProductId === "string" && parsed.subjectProductId.trim()) {
		subjectProductId = parsed.subjectProductId.trim().slice(0, 64);
	}
	if (typeof parsed.subjectProductName === "string" && parsed.subjectProductName.trim()) {
		subjectProductName = parsed.subjectProductName.trim().slice(0, 200);
	}

	let inquiry = access.inquiry;
	if (session?.user?.role === "customer" && session.user.customerId) {
		inquiry = await claimAnonymousThreadIfNeeded(inquiry, session.user.customerId);
	}

	if (
		guestChatLoginRequired({
			customerId: inquiry.customerId?.toString(),
			phoneNumber: inquiry.phoneNumber,
			guestMessageLimit: settings.guestMessageLimit,
			messages: inquiry.messages,
		})
	) {
		return Response.json(
			{
				error: "Sign in to keep chatting — you've used your free preview messages.",
				code: "login_required",
			},
			{ status: 403 },
		);
	}

	await connectDB();
	try {
		const now = new Date();
		// Use the post-claim id: claiming may merge the guest thread into the
		// customer's canonical thread (a different doc) and delete this one.
		const inquiryId = inquiry._id;
		await InquiryModel.updateOne(
			{ _id: inquiryId },
			{
				$push: {
					messages: {
						author: "customer",
						authorName: inquiry.customerName,
						body: bodyResult,
						createdAt: now,
					},
				},
				$set: {
					lastMessageAt: now,
					lastMessagePreview: bodyResult.slice(0, 280),
					lastMessageAuthor: "customer",
					unreadByCustomer: 0,
					...inquiryStatusPatchAfterMessage(inquiry.status, "customer"),
					...(inquiry.customerId ? { customerId: inquiry.customerId } : {}),
					...(inquiry.customerName ? { customerName: inquiry.customerName } : {}),
					...(inquiry.phoneNumber ? { phoneNumber: inquiry.phoneNumber } : {}),
					...(subjectProductId ? { subjectProductId } : {}),
					...(subjectProductName ? { subjectProductName } : {}),
				},
				$inc: { unreadByTeam: 1 },
			},
		);

		const refreshed = await InquiryModel.findById(inquiryId).lean<InquiryLean>();
		if (!refreshed) {
			return serverError("Thread vanished while posting your message.");
		}

		const [settings, integration] = await Promise.all([getStoreSettings(), getIntegrationSettings()]);
		const { notifyEmails, notifyWhatsAppPhones } = await resolveInquiryStaffNotifyTargets(refreshed, integration, settings);
		if (notifyEmails.length || notifyWhatsAppPhones.length) {
			void notifyStaffOnCustomerMessage({
				inquiryId: inquiryId.toString(),
				customerName: refreshed.customerName ?? "Guest",
				phoneNumber: refreshed.phoneNumber,
				messagePreview: bodyResult,
				notifyEmails,
				notifyWhatsAppPhones,
				whatsappStaffNotifyTemplate: integration.whatsappStaffNotifyTemplate.trim() || undefined,
				siteName: settings.siteName,
				adminSiteUrl: integration.adminSiteUrl.trim() || undefined,
			});
		}

		const verifiedCustomerId =
			session?.user?.role === "customer" && session.user.customerId && refreshed.customerId?.toString() === session.user.customerId ? session.user.customerId : undefined;

		try {
			await maybeReplyWithAssistant(refreshed, { verifiedCustomerId });
		} catch (assistantError) {
			logger.error({ assistantError, inquiryId: id }, "chat-assistant: auto-reply failed");
		}

		const withAssistant = (await reloadInquiry(inquiryId)) ?? refreshed;
		return created(toThreadLatestPage(withAssistant));
	} catch (error) {
		logger.error({ error, inquiryId: id }, "Failed to post chat message");
		return serverError("Could not send your message. Please try again.");
	}
}
