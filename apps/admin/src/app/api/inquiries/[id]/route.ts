import { requireSession } from "@/lib/api/requireSession";
import { connectDB, handleMongoError, Inquiry, INQUIRY_STATUSES, type InquiryMessageAttributes, type InquiryStatus } from "@store/db";
import {
	asArray,
	badRequest,
	CHAT_MESSAGE_PAGE_SIZE,
	FIELD_LIMITS,
	isThreadUnchangedForPoll,
	isValidId,
	noContent,
	notFound,
	notModified,
	ok,
	parseBody,
	parsePollSince,
	sliceChatMessages,
	threadPollEtag,
} from "@store/shared";

import { recordActivity } from "@/lib/services/activityLog";
import { toInquiryLatestPage, toInquiryResponse, type InquiryLean } from "@/lib/serializers/inquiry";

const ALLOWED_STATUSES = new Set<string>(INQUIRY_STATUSES);

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * Admin patch surface for a single chat thread (status, assignee, internal notes).
 */
interface InquiryUpdateInput {
	status?: unknown;
	assignedToUserId?: unknown;
	internalNotes?: unknown;
}

export async function GET(request: Request, { params }: RouteContext) {
	const { response } = await requireSession("inquiry_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const doc = await Inquiry.findById(id).lean<InquiryLean>();
	if (!doc) {
		return notFound("Inquiry not found");
	}

	const url = new URL(request.url);
	const since = parsePollSince(url.searchParams.get("since"));
	const beforeId = url.searchParams.get("before");
	const etag = threadPollEtag(doc.lastMessageAt);
	if (
		since &&
		isThreadUnchangedForPoll({
			lastMessageAt: doc.lastMessageAt,
			updatedAt: doc.updatedAt,
			since,
			ifNoneMatch: request.headers.get("If-None-Match"),
		})
	) {
		return notModified(etag);
	}

	const allMessages = asArray<InquiryMessageAttributes>(doc.messages);
	const slice = sliceChatMessages(allMessages, {
		beforeId,
		sinceMillis: since ? since.getTime() : null,
		limit: CHAT_MESSAGE_PAGE_SIZE,
	});
	const res = ok(
		toInquiryResponse(doc, {
			includeInternal: true,
			page: {
				messages: allMessages.slice(slice.start, slice.end),
				hasMoreOlder: slice.hasMoreOlder,
			},
		}),
	);
	res.headers.set("ETag", etag);
	return res;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("inquiry_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<InquiryUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};
	let nextStatus: InquiryStatus | undefined;
	if (typeof body.status === "string") {
		if (!ALLOWED_STATUSES.has(body.status)) {
			return badRequest(`Status must be one of: ${INQUIRY_STATUSES.join(", ")}`);
		}
		nextStatus = body.status as InquiryStatus;
		update.status = nextStatus;
	}
	if (body.assignedToUserId !== undefined) {
		if (body.assignedToUserId === null) {
			update.assignedToUserId = null;
		} else if (typeof body.assignedToUserId === "string" && isValidId(body.assignedToUserId)) {
			update.assignedToUserId = body.assignedToUserId;
		} else {
			return badRequest("assignedToUserId must be a Mongo ObjectId or null.");
		}
	}
	if (typeof body.internalNotes === "string") {
		update.internalNotes = body.internalNotes.trim().slice(0, FIELD_LIMITS.messageBody);
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const doc = await Inquiry.findByIdAndUpdate(
			id,
			{ $set: update },
			{
				new: true,
				runValidators: true,
			},
		).lean<InquiryLean>();
		if (!doc) {
			return notFound("Inquiry not found");
		}

		const label = doc.subjectProductName ? `${doc.customerName} · ${doc.subjectProductName}` : doc.customerName;
		await recordActivity({
			actor,
			action: nextStatus ? "status_changed" : "updated",
			resourceType: "inquiry",
			resourceId: id,
			resourceLabel: label,
			detail: nextStatus ? `Status → ${nextStatus}` : undefined,
		});
		return ok(toInquiryLatestPage(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("inquiry_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	try {
		const doc = await Inquiry.findByIdAndDelete(id).lean<InquiryLean>();
		if (!doc) {
			return notFound("Inquiry not found");
		}

		const label = doc.subjectProductName ? `${doc.customerName} · ${doc.subjectProductName}` : doc.customerName;
		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "inquiry",
			resourceId: id,
			resourceLabel: label,
		});
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
