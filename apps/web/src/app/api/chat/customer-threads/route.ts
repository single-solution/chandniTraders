/**
 * POST /api/chat/customer-threads
 *
 * Returns the signed-in customer's single support conversation, creating it
 * the first time. A customer only ever has ONE thread — repeat calls reuse
 * the existing one so history stays in a single place. The first message is
 * sent via POST .../messages.
 */

import { Types } from "mongoose";

import { Customer, Inquiry as InquiryModel, connectDB, isMongoDuplicateKeyError } from "@store/db";
import { badRequest, created, logger, resolveChatWelcomeMessage, serverError } from "@store/shared";

import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { getChatSettings } from "@/lib/chat/chatSettings";
import { getVerifiedCustomer } from "@/lib/server/customerSession";
import { toThreadLatestPage } from "@/lib/chat/serializer";
import type { InquiryLean } from "@/lib/chat/serializer";

interface CreateCustomerThreadBody {
	subjectProductId?: unknown;
	subjectProductName?: unknown;
}

export async function POST(request: Request) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const settings = await getChatSettings();
	if (!settings.enabled) {
		return badRequest("Chat is currently disabled.");
	}

	const actor = await getVerifiedCustomer();
	if (!actor) {
		return badRequest("Sign in to start a conversation.");
	}

	let subjectProductId: string | undefined;
	let subjectProductName: string | undefined;
	try {
		const body = (await request.json()) as CreateCustomerThreadBody;
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

	await connectDB();
	const customerId = new Types.ObjectId(actor.id);

	// One conversation per customer: reuse the existing thread if there is one.
	const existing = await InquiryModel.findOne({ customerId }).sort({ lastMessageAt: -1 }).lean<InquiryLean>();
	if (existing) {
		return created(toThreadLatestPage(existing));
	}

	const customer = await Customer.findById(actor.id).select({ name: 1, phoneNumber: 1 }).lean<{ name: string; phoneNumber: string }>();
	if (!customer) {
		return badRequest("Customer account not found.");
	}

	try {
		const now = new Date();
		const welcome = resolveChatWelcomeMessage({
			audience: "customer",
			settings,
			guestMessageLimit: settings.guestMessageLimit,
		});
		const doc = await InquiryModel.create({
			customerName: customer.name,
			phoneNumber: customer.phoneNumber,
			customerId,
			status: "open",
			lastMessageAt: now,
			lastMessagePreview: welcome.slice(0, 280),
			lastMessageAuthor: "assistant",
			unreadByCustomer: 0,
			unreadByTeam: 0,
			messages: [],
		});

		const lean = await InquiryModel.findById(doc._id).lean<InquiryLean>();
		if (!lean) {
			return serverError("Thread vanished after creation.");
		}

		return created(toThreadLatestPage(lean));
	} catch (error) {
		// Two concurrent first-opens race past the reuse check; the unique
		// `customerId` index rejects the loser — fall back to the winner's thread.
		if (isMongoDuplicateKeyError(error)) {
			const winner = await InquiryModel.findOne({ customerId }).lean<InquiryLean>();
			if (winner) {
				return created(toThreadLatestPage(winner));
			}
		}
		logger.error({ error }, "Failed to start customer chat thread");
		return serverError("Could not open chat. Please try again.");
	}
}
