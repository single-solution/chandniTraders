import { Types } from "mongoose";

import { cookies } from "next/headers";

import { Customer, Inquiry as InquiryModel, connectDB } from "@store/db";
import type { InquiryMessageAttributes } from "@store/db";
import { isAnonymousChatPhone, isValidId, verifyGuestToken } from "@store/shared";

import type { InquiryLean } from "@/lib/chat/serializer";

const GUEST_THREAD_COOKIE = "inquiry_thread_token";

function sortedByCreatedAt(messages: InquiryMessageAttributes[]): InquiryMessageAttributes[] {
	return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

/**
 * Fold a just-signed-in guest's preview thread into the customer's canonical
 * conversation, then delete the guest doc — a customer must only ever hold ONE
 * thread (enforced by the unique `customerId` index). The guest's messages are
 * appended chronologically so history reads as a single timeline.
 */
async function mergeGuestIntoCanonical(canonical: InquiryLean, guest: InquiryLean, customer: { name: string; phoneNumber: string }): Promise<InquiryLean> {
	const canonicalMessages = canonical.messages ?? [];
	const guestMessages = [...(guest.messages ?? [])];

	// The guest thread always starts with a welcome message. If we append it to a canonical
	// thread that already has messages, we'll get a duplicate welcome message in the middle
	// of the history. Drop the guest's initial welcome message if it exists.
	if (canonicalMessages.length > 0 && guestMessages.length > 0 && guestMessages[0].author === "assistant") {
		guestMessages.shift();
	}

	const messages = sortedByCreatedAt([...canonicalMessages, ...guestMessages]);
	const last = messages[messages.length - 1];
	const status = last?.author === "customer" ? "open" : canonical.status;

	await InquiryModel.updateOne(
		{ _id: canonical._id },
		{
			$set: {
				messages,
				status,
				customerName: customer.name,
				phoneNumber: customer.phoneNumber,
				lastMessageAt: last?.createdAt ?? canonical.lastMessageAt,
				lastMessagePreview: (last?.body ?? canonical.lastMessagePreview ?? "").slice(0, 280),
				lastMessageAuthor: last?.author ?? canonical.lastMessageAuthor,
				unreadByCustomer: (canonical.unreadByCustomer ?? 0) + (guest.unreadByCustomer ?? 0),
				unreadByTeam: (canonical.unreadByTeam ?? 0) + (guest.unreadByTeam ?? 0),
				...(canonical.subjectProductId || !guest.subjectProductId ? {} : { subjectProductId: guest.subjectProductId }),
				...(canonical.subjectProductName || !guest.subjectProductName ? {} : { subjectProductName: guest.subjectProductName }),
			},
		},
	);
	await InquiryModel.deleteOne({ _id: guest._id });

	const refreshed = await InquiryModel.findById(canonical._id).lean<InquiryLean>();
	return refreshed ?? canonical;
}

/**
 * Link an anonymous preview thread to the signed-in customer after OTP login.
 * If the customer already has a thread, the guest thread is merged into it and
 * removed; otherwise the guest thread is claimed in place. Returns the canonical
 * thread (note: its `_id` differs from the guest's when a merge happened).
 */
export async function claimAnonymousThreadIfNeeded(inquiry: InquiryLean, customerId: string): Promise<InquiryLean> {
	if (!isAnonymousChatPhone(inquiry.phoneNumber) || inquiry.customerId) {
		return inquiry;
	}

	await connectDB();
	const customer = await Customer.findById(customerId).select({ name: 1, phoneNumber: 1 }).lean<{ name: string; phoneNumber: string }>();
	if (!customer) {
		return inquiry;
	}

	const customerObjectId = new Types.ObjectId(customerId);
	const existing = await InquiryModel.findOne({ customerId: customerObjectId }).sort({ createdAt: 1 }).lean<InquiryLean>();

	if (existing && existing._id.toString() !== inquiry._id.toString()) {
		return mergeGuestIntoCanonical(existing, inquiry, customer);
	}

	const updated = await InquiryModel.findByIdAndUpdate(
		inquiry._id,
		{
			$set: {
				customerId: customerObjectId,
				customerName: customer.name,
				phoneNumber: customer.phoneNumber,
			},
		},
		{ new: true },
	).lean<InquiryLean>();

	return updated ?? inquiry;
}

/**
 * After OTP sign-in, fold any guest preview threads from the browser cookie into
 * the customer's canonical conversation so pre-login messages are not orphaned.
 */
export async function claimGuestThreadsFromCookie(customerId: string): Promise<void> {
	const cookieJar = await cookies();
	const token = cookieJar.get(GUEST_THREAD_COOKIE)?.value;
	const payload = await verifyGuestToken(token);
	if (!payload || payload.inquiryIds.length === 0) {
		return;
	}

	await connectDB();
	const inquiryIds = payload.inquiryIds.filter((id) => isValidId(id)).map((id) => new Types.ObjectId(id));
	if (inquiryIds.length === 0) {
		return;
	}

	const guests = await InquiryModel.find({
		_id: { $in: inquiryIds },
		phoneNumber: payload.phoneNumber,
	}).lean<InquiryLean[]>();

	for (const guest of guests) {
		if (isAnonymousChatPhone(guest.phoneNumber)) {
			await claimAnonymousThreadIfNeeded(guest, customerId);
		}
	}
}
