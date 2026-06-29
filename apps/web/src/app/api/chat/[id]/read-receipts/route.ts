/**
 * POST /api/chat/[id]/read-receipts
 *
 * Customer marks a thread's agent messages as read. Creates a read
 * receipt (resource-noun URL) rather than the previous verb URL
 * (`/[id]/read`).
 */

import { Inquiry as InquiryModel, connectDB } from "@store/db";
import { logger, noContent, serverError } from "@store/shared";

import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { enforceChatPollRateLimit } from "@/lib/api/chatRateLimit";
import { resolveChatAccess } from "@/lib/chat/access";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: RouteContext) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const rateLimited = enforceChatPollRateLimit(request);
	if (rateLimited) {
		return rateLimited;
	}

	const { id } = await params;
	const access = await resolveChatAccess(id);
	if (access instanceof Response) return access;

	const inquiry = access.inquiry;
	if (inquiry.unreadByCustomer <= 0) {
		return noContent();
	}

	try {
		await connectDB();
		const now = new Date();
		await InquiryModel.updateOne(
			{ _id: inquiry._id },
			{
				$set: {
					unreadByCustomer: 0,
					"messages.$[unread].readByCustomerAt": now,
				},
			},
			{
				arrayFilters: [{ "unread.author": "agent", "unread.readByCustomerAt": { $exists: false } }],
			},
		);

		return noContent();
	} catch (error) {
		logger.error({ error, inquiryId: id }, "Failed to mark chat as read");
		return serverError("Failed to mark chat as read.");
	}
}
