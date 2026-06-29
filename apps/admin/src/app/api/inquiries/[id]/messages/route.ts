/**
 * POST /api/inquiries/[id]/messages
 *
 * Admin sends a reply into a chat thread. Permission-gated by
 * `inquiry_manage`. Reading the thread (`GET /api/inquiries/[id]`)
 * uses the lower-privilege session check; only replying / mutating
 * requires the explicit permission.
 *
 * Side effects:
 *   - Push new message with `author: "agent"` and the replying user's
 *     id + name for denormalised display.
 *   - `lastMessage*` updated; `unreadByCustomer` += 1; `unreadByTeam`
 *     reset to 0 since the team just touched the thread.
 *   - When the thread was `open`, flip to `awaiting-customer` so the
 *     inbox surface dimensions reflect "we're waiting on them now".
 *   - Auto-assign to the replying admin if `assignedToUserId` is unset
 *     (first-reply ownership).
 */

import { Inquiry, connectDB, getIntegrationSettings, getStoreSettings, handleMongoError } from "@store/db";
import { badRequest, CHAT_MESSAGE_BODY_MAX, created, isFieldError, isValidId, notFound, parseBody, validateMessageBody } from "@store/shared";
import { notifyCustomerOnAgentReply } from "@store/shared/server";

import { inquiryStatusPatchAfterMessage } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { recordActivity } from "@/lib/services/activityLog";
import { toInquiryLatestPage, type InquiryLean } from "@/lib/serializers/inquiry";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface PostBody {
	body?: unknown;
}

export async function POST(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("inquiry_reply");
	if (response) return response;

	const { id } = await params;
	if (!isValidId(id)) return badRequest("Invalid ID.");

	const parsed = await parseBody<PostBody>(request);
	if (parsed instanceof Response) return parsed;

	const bodyResult = validateMessageBody(parsed.body);
	if (isFieldError(bodyResult)) {
		return badRequest(bodyResult.error);
	}
	if (bodyResult.length > CHAT_MESSAGE_BODY_MAX) {
		return badRequest("Message too long.");
	}

	await connectDB();
	try {
		const inquiry = await Inquiry.findById(id).lean<InquiryLean>();
		if (!inquiry) return notFound("Inquiry not found");

		const MSG_PREVIEW_MAX_LENGTH = 280;
		const now = new Date();
		const keepManualBotPause = inquiry.assistantMuteReason === "manual";
		const update: Record<string, unknown> = {
			$push: {
				messages: {
					author: "agent",
					authorName: actor.name,
					authorUserId: actor.id,
					body: bodyResult,
					createdAt: now,
				},
			},
			$set: {
				lastMessageAt: now,
				lastMessagePreview: bodyResult.slice(0, MSG_PREVIEW_MAX_LENGTH),
				lastMessageAuthor: "agent",
				unreadByTeam: 0,
				...inquiryStatusPatchAfterMessage(inquiry?.status, "team"),
				...(inquiry?.assignedToUserId ? {} : { assignedToUserId: actor.id }),
				...(keepManualBotPause
					? {}
					: {
							assistantMuted: false,
							assistantMuteReason: null,
							assistantMutedAt: null,
							assistantMutedByUserId: null,
							escalatedAt: null,
						}),
			},
			$inc: { unreadByCustomer: 1 },
		};

		await Inquiry.updateOne({ _id: id }, update);
		const refreshed = await Inquiry.findById(id).lean<InquiryLean>();
		if (!refreshed) return notFound("Inquiry not found");

		const label = refreshed.subjectProductName ? `${refreshed.customerName} · ${refreshed.subjectProductName}` : refreshed.customerName;
		await recordActivity({
			actor,
			action: "updated",
			resourceType: "inquiry",
			resourceId: id,
			resourceLabel: label,
			detail: "Replied",
		});

		const [integration, settings] = await Promise.all([getIntegrationSettings(), getStoreSettings()]);
		void notifyCustomerOnAgentReply({
			customerPhone: refreshed.phoneNumber,
			customerName: refreshed.customerName ?? "Customer",
			agentName: actor.name,
			messagePreview: bodyResult,
			siteName: settings.siteName,
			whatsappCustomerOrderTemplate: integration.whatsappCustomerOrderTemplate.trim() || undefined,
		});

		return created(toInquiryLatestPage(refreshed));
	} catch (error) {
		return handleMongoError(error);
	}
}
