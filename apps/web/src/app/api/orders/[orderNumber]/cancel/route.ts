import { applyOrderTransition, claimOrderStatusTransition, connectDB, fireOrderEventNotifications, handleMongoError, Order as OrderModel } from "@store/db";
import { badRequest, conflict, isCustomerCancellableOrderStatus, notFound, ok, unauthorized } from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { getVerifiedCustomer } from "@/lib/server/customerSession";

const CANCEL_RATE_LIMIT_SCOPE = "storefront-order-cancel";
const CANCEL_MAX_PER_WINDOW = 10;
const CANCEL_WINDOW_MS = 15 * 60 * 1000;

interface RouteContext {
	params: Promise<{ orderNumber: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const actor = await getVerifiedCustomer();
	if (!actor) {
		return unauthorized();
	}

	const limited = enforcePublicRateLimit(request, {
		scope: CANCEL_RATE_LIMIT_SCOPE,
		max: CANCEL_MAX_PER_WINDOW,
		windowMs: CANCEL_WINDOW_MS,
		identifier: actor.id,
	});
	if (limited) {
		return limited;
	}

	const { orderNumber: rawOrderNumber } = await params;
	const orderNumber = rawOrderNumber?.trim();
	if (!orderNumber) {
		return badRequest("Order number is required.");
	}

	await connectDB();

	try {
		const existing = await OrderModel.findOne({ orderNumber, customerId: actor.id });
		if (!existing) {
			return notFound("Order not found.");
		}
		if (!isCustomerCancellableOrderStatus(existing.status)) {
			return conflict("This order can no longer be cancelled online. Message us on WhatsApp for help.");
		}

		const previousStatus = existing.status;
		const claimed = await claimOrderStatusTransition({
			orderNumber,
			customerId: actor.id,
			fromStatuses: [previousStatus],
			toStatus: "cancelled",
			timelineNote: "Cancelled by customer.",
		});

		if (!claimed) {
			return conflict("This order was just updated. Refresh and try again.");
		}

		await applyOrderTransition({
			order: claimed,
			previousStatus,
			nextStatus: "cancelled",
			actor: { id: actor.id },
		});

		void fireOrderEventNotifications({
			event: "cancelled",
			order: claimed,
			previousStatus,
			nextStatus: "cancelled",
		}).catch(() => undefined);

		return ok({ orderNumber: claimed.orderNumber, status: claimed.status });
	} catch (error) {
		return handleMongoError(error);
	}
}
