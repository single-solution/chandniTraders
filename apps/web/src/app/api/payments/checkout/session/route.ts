import { connectDB, getIntegrationSettings, getStoreSettings, handleMongoError, Order as OrderModel } from "@store/db";
import {
	badRequest,
	forbidden,
	isOnlineCardCheckoutReady,
	notFound,
	ok,
	parseBody,
	resolvePublicSiteUrl,
	serverError,
} from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { startOrderOnlineCheckout, toOnlineCheckoutApiResponse } from "@/lib/payments/startOnlineCheckout";
import { getVerifiedCustomer } from "@/lib/server/customerSession";

export const dynamic = "force-dynamic";

interface SessionBody {
	orderNumber?: unknown;
}

export async function POST(request: Request): Promise<Response> {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const actor = await getVerifiedCustomer();
	if (!actor) {
		return forbidden("Sign in to complete online payment.");
	}

	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-checkout-session",
		max: 10,
		windowMs: 60_000,
		identifier: actor.id,
	});
	if (limited) {
		return limited;
	}

	const body = await parseBody<SessionBody>(request);
	if (body instanceof Response) {
		return body;
	}

	const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
	if (!orderNumber) {
		return badRequest("Order number is required.");
	}

	await connectDB();

	try {
		const order = await OrderModel.findOne({
			orderNumber,
			customerId: actor.id,
		});

		if (!order) {
			return notFound("Order not found.");
		}

		if (order.payment !== "card") {
			return badRequest("This order does not use online payment.");
		}

		if (order.status !== "pending-payment") {
			return badRequest("This order no longer needs payment.");
		}

		const [integration, settings] = await Promise.all([getIntegrationSettings(), getStoreSettings()]);
		if (!isOnlineCardCheckoutReady(integration)) {
			return serverError("Online payments are temporarily unavailable. Choose bank transfer or cash on delivery.");
		}

		const checkout = await startOrderOnlineCheckout({
			order,
			integration,
			storeName: settings.siteName,
			publicSiteUrl: resolvePublicSiteUrl(settings.publicSiteUrl) || settings.publicSiteUrl,
		});

		return ok(toOnlineCheckoutApiResponse(checkout));
	} catch (error) {
		if (error instanceof Error && error.message.includes("not configured")) {
			return serverError("Online payments are temporarily unavailable. Please contact support.");
		}
		return handleMongoError(error);
	}
}
