import { NextResponse } from "next/server";

import { getIntegrationSettings } from "@store/db";
import { logger } from "@store/shared";

import { confirmOrderPaidOnline } from "@/lib/payments/confirmOnlinePayment";
import { isPayFastPaymentSuccess, parsePayFastPaidAmountRupees, verifyPayFastCallbackHash } from "@/lib/payments/payfastCheckout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const integration = await getIntegrationSettings();
	const params = new URLSearchParams(await request.text());

	const basketId = params.get("basket_id")?.trim() || "";
	const errCode = params.get("err_code")?.trim() || params.get("ERR_CODE")?.trim() || "";
	const validationHash = params.get("validation_hash")?.trim() || params.get("VALIDATION_HASH")?.trim() || "";

	if (!basketId || !verifyPayFastCallbackHash(integration, basketId, errCode, validationHash)) {
		logger.warn({ basketId }, "PayFast IPN hash verification failed");
		return NextResponse.json({ received: false }, { status: 400 });
	}

	if (!isPayFastPaymentSuccess(errCode)) {
		return NextResponse.json({ received: true });
	}

	try {
		const paidAmountRupees = parsePayFastPaidAmountRupees(params);
		const result = await confirmOrderPaidOnline({
			orderNumber: basketId,
			gatewayProvider: "payfast",
			gatewayPaymentRef: basketId,
			paidAmountRupees,
		});
		if (!result.confirmed) {
			return NextResponse.json({ received: false }, { status: 400 });
		}
	} catch (error) {
		logger.error({ error, basketId }, "PayFast IPN order confirmation failed");
		return NextResponse.json({ received: false }, { status: 500 });
	}

	return NextResponse.json({ received: true });
}
