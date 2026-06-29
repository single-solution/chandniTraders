/**
 * POST /api/inquiries/[id]/assistant
 *
 * Pause or resume the AI assistant on a single chat thread.
 */
import { Inquiry, connectDB, handleMongoError } from "@store/db";
import { badRequest, created, isValidId, notFound, parseBody } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { recordActivity } from "@/lib/services/activityLog";
import { toInquiryLatestPage, type InquiryLean } from "@/lib/serializers/inquiry";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface PostBody {
	enabled?: unknown;
}

export async function POST(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("inquiry_reply");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<PostBody>(request);
	if (body instanceof Response) {
		return body;
	}
	if (typeof body.enabled !== "boolean") {
		return badRequest('Body must include boolean "enabled".');
	}

	await connectDB();
	try {
		const inquiry = await Inquiry.findById(id).lean<InquiryLean>();
		if (!inquiry) {
			return notFound("Inquiry not found");
		}

		const now = new Date();
		const update = body.enabled
			? {
					assistantMuted: false,
					assistantMuteReason: null,
					assistantMutedAt: null,
					assistantMutedByUserId: null,
					escalatedAt: null,
				}
			: {
					assistantMuted: true,
					assistantMuteReason: "manual" as const,
					assistantMutedAt: now,
					assistantMutedByUserId: actor.id,
				};

		await Inquiry.updateOne({ _id: id }, { $set: update });
		const refreshed = await Inquiry.findById(id).lean<InquiryLean>();
		if (!refreshed) {
			return notFound("Inquiry not found");
		}

		const label = refreshed.subjectProductName ? `${refreshed.customerName} · ${refreshed.subjectProductName}` : refreshed.customerName;
		await recordActivity({
			actor,
			action: "updated",
			resourceType: "inquiry",
			resourceId: id,
			resourceLabel: label,
			detail: body.enabled ? "Assistant resumed" : "Assistant paused",
		});

		return created(toInquiryLatestPage(refreshed));
	} catch (error) {
		return handleMongoError(error);
	}
}
