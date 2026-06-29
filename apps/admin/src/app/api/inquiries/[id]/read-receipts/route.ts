/**
 * POST /api/inquiries/[id]/read-receipts
 *
 * Admin marks customer messages as read. Creates a team read receipt
 * (resource-noun URL) rather than the previous verb URL (`/[id]/read`).
 */

import { Inquiry, connectDB } from "@store/db";
import { badRequest, isValidId, noContent, notFound } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import type { InquiryLean } from "@/lib/serializers/inquiry";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("inquiry_view");
	if (response) return response;

	const { id } = await params;
	if (!isValidId(id)) return badRequest("Invalid ID.");

	await connectDB();
	const inquiry = await Inquiry.findById(id).lean<InquiryLean>();
	if (!inquiry) return notFound("Inquiry not found");

	if (inquiry.unreadByTeam <= 0) {
		return noContent();
	}

	const now = new Date();
	await Inquiry.updateOne(
		{ _id: id },
		{
			$set: {
				unreadByTeam: 0,
				"messages.$[unread].readByTeamAt": now,
			},
		},
		{
			arrayFilters: [{ "unread.author": "customer", "unread.readByTeamAt": { $exists: false } }],
		},
	);

	return noContent();
}
