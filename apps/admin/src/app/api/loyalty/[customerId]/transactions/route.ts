import mongoose from "mongoose";
import { badRequest, created, FIELD_LIMITS, isValidationError, isValidId, notFound, forbidden, parseBody, validateString } from "@store/shared";
import { connectDB, Customer, handleMongoError, LOYALTY_TRANSACTION_KINDS, LoyaltyAccount, type LoyaltyTransactionKind } from "@store/db";

import { requireSession } from "@/lib/api/requireSession";
import { hasPermission } from "@/lib/permissions";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";

import { toLoyaltyAccountResponse, type LoyaltyAccountLean } from "@/lib/serializers/loyalty";

const ALLOWED_KINDS = new Set<string>(LOYALTY_TRANSACTION_KINDS);

const ORDER_REF_MAX_CHARS = 32;

interface RouteContext {
	params: Promise<{ customerId: string }>;
}

interface TransactionInput {
	kind?: unknown;
	amount?: unknown;
	reason?: unknown;
	orderRef?: unknown;
}

export async function POST(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession();
	if (response) {
		return response;
	}
	if (!hasPermission(actor, "loyalty_manage") && !hasPermission(actor, "customer_manage")) {
		return forbidden();
	}

	const { customerId } = await params;
	if (!isValidId(customerId)) {
		return badRequest("Invalid customer ID.");
	}

	const body = await parseBody<TransactionInput>(request);
	if (body instanceof Response) {
		return body;
	}

	if (typeof body.kind !== "string" || !ALLOWED_KINDS.has(body.kind)) {
		return badRequest(`Kind must be one of: ${LOYALTY_TRANSACTION_KINDS.join(", ")}`);
	}
	const kind = body.kind as LoyaltyTransactionKind;

	const amount = Number(body.amount);
	if (!Number.isFinite(amount) || amount === 0) {
		return badRequest("Amount must be a non-zero number.");
	}

	const reasonResult = validateString(body.reason, { label: "Reason", max: FIELD_LIMITS.shortText });
	if (isValidationError(reasonResult)) {
		return badRequest(reasonResult.error);
	}

	await connectDB();
	try {
		const customer = await Customer.findById(customerId).lean();
		if (!customer) {
			return notFound("Customer not found");
		}

		const account = await LoyaltyAccount.findOneAndUpdate(
			{ customerId },
			{ $setOnInsert: { customerId, balance: 0, lifetimeEarned: 0, pendingFromShipping: 0 } },
			{ new: true, upsert: true },
		);

		const isPositive = kind === "earn" || kind === "bonus" || (kind === "adjust" && amount > 0);
		const isNegative = kind === "redeem" || kind === "expire" || (kind === "adjust" && amount < 0);

		if (isPositive) {
			account.balance += Math.abs(amount);
			account.lifetimeEarned += Math.abs(amount);
		} else if (isNegative) {
			const absAmount = Math.abs(amount);
			if (account.balance < absAmount) {
				return badRequest("Insufficient points to redeem.");
			}
			account.balance -= absAmount;
		}

		account.transactions.push({
			kind,
			amount,
			occurredAt: new Date(),
			reason: reasonResult,
			orderRef: typeof body.orderRef === "string" ? body.orderRef.slice(0, ORDER_REF_MAX_CHARS) : undefined,
			recordedByUserId: new mongoose.Types.ObjectId(actor.id),
		});

		await account.save();
		await recordActivity({
			actor,
			action: "updated",
			resourceType: "loyalty",
			resourceId: account._id.toString(),
			resourceLabel: customer.name,
			detail: `${kind} ${amount} pts: ${reasonResult}`,
		});

		bustAdminCaches();
		return created(toLoyaltyAccountResponse(account.toObject() as unknown as LoyaltyAccountLean, customer.name));
	} catch (error) {
		return handleMongoError(error);
	}
}
