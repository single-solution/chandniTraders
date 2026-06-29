import { NextResponse } from "next/server";

import { connectDB, getIntegrationSettings, Order as OrderModel } from "@store/db";
import { logger } from "@store/shared";

import { confirmOrderPaidOnline } from "@/lib/payments/confirmOnlinePayment";
import { isPayFastPaymentSuccess, parsePayFastPaidAmountRupees, verifyPayFastCallbackHash } from "@/lib/payments/payfastCheckout";

export const dynamic = "force-dynamic";

async function handlePayFastCallback(request: Request) {
	const integration = await getIntegrationSettings();
	const url = new URL(request.url);
	const params = request.method === "POST" ? new URLSearchParams(await request.text()) : url.searchParams;

	const orderNumber = params.get("order")?.trim() || params.get("basket_id")?.trim() || "";
	const errCode = params.get("err_code")?.trim() || params.get("ERR_CODE")?.trim() || "";
	const validationHash = params.get("validation_hash")?.trim() || params.get("VALIDATION_HASH")?.trim() || "";
	const basketId = params.get("basket_id")?.trim() || orderNumber;

	if (!orderNumber) {
		return NextResponse.redirect(new URL("/account#orders", url.origin));
	}

	if (!verifyPayFastCallbackHash(integration, basketId, errCode, validationHash)) {
		logger.warn({ orderNumber, basketId }, "PayFast callback hash verification failed");
		const cancelledPath = orderNumber
			? `/checkout?cancelled=1&order=${encodeURIComponent(orderNumber)}`
			: `/checkout?cancelled=1`;
		return NextResponse.redirect(new URL(cancelledPath, url.origin));
	}

	if (!isPayFastPaymentSuccess(errCode)) {
		const cancelledPath = orderNumber
			? `/checkout?cancelled=1&order=${encodeURIComponent(orderNumber)}`
			: `/checkout?cancelled=1`;
		return NextResponse.redirect(new URL(cancelledPath, url.origin));
	}

	await connectDB();
	const order = await OrderModel.findOne({ orderNumber });
	if (order) {
		const paidAmountRupees = parsePayFastPaidAmountRupees(params);
		const result = await confirmOrderPaidOnline({
			orderId: order._id.toString(),
			orderNumber: order.orderNumber,
			gatewayProvider: "payfast",
			gatewayPaymentRef: basketId,
			paidAmountRupees,
		});
		if (!result.confirmed) {
			return NextResponse.redirect(new URL(`/checkout?cancelled=1&order=${encodeURIComponent(orderNumber)}`, url.origin));
		}
	}

	return NextResponse.redirect(new URL(`/checkout/success?order=${encodeURIComponent(orderNumber)}`, url.origin));
}

export async function GET(request: Request) {
	try {
		return await handlePayFastCallback(request);
	} catch (error) {
		logger.error({ error }, "PayFast callback failed");
		return NextResponse.redirect(new URL("/checkout?cancelled=1", new URL(request.url).origin));
	}
}

export async function POST(request: Request) {
	try {
		return await handlePayFastCallback(request);
	} catch (error) {
		logger.error({ error }, "PayFast IPN failed");
		return NextResponse.json({ received: false }, { status: 500 });
	}
}
