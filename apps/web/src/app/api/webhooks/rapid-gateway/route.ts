import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { getIntegrationSettings } from "@store/db";
import { logger } from "@store/shared";

import { confirmOrderPaidOnline } from "@/lib/payments/confirmOnlinePayment";

export const dynamic = "force-dynamic";

function verifyRapidSignature(rawBody: string, signature: string, secret: string): boolean {
	if (!signature.trim() || !secret.trim()) {
		return false;
	}
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	try {
		return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.trim()));
	} catch {
		return false;
	}
}

export async function POST(request: Request) {
	const integration = await getIntegrationSettings();
	const webhookSecret = integration.rapidGatewayWebhookSecret.trim();
	if (!webhookSecret) {
		return NextResponse.json({ error: "Rapid Gateway webhook is not configured." }, { status: 503 });
	}

	const rawBody = await request.text();
	const signature = request.headers.get("x-rg-signature") ?? request.headers.get("X-RG-Signature") ?? "";

	if (!verifyRapidSignature(rawBody, signature, webhookSecret)) {
		logger.warn("Rapid Gateway webhook signature verification failed");
		return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
	}

	let payload: {
		status?: string;
		amount?: number;
		metadata?: { orderId?: string; orderNumber?: string };
		id?: string;
	};

	try {
		payload = JSON.parse(rawBody) as typeof payload;
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}

	const status = payload.status?.trim().toLowerCase() ?? "";
	if (status !== "succeeded" && status !== "paid" && status !== "success") {
		return NextResponse.json({ received: true });
	}

	try {
		const result = await confirmOrderPaidOnline({
			orderId: payload.metadata?.orderId,
			orderNumber: payload.metadata?.orderNumber,
			gatewayProvider: "rapid-gateway",
			gatewayPaymentRef: payload.id,
			paidAmountRupees: typeof payload.amount === "number" ? payload.amount : undefined,
		});
		if (!result.confirmed) {
			return NextResponse.json({ error: "Amount mismatch." }, { status: 400 });
		}
	} catch (error) {
		logger.error({ error }, "Rapid Gateway webhook order confirmation failed");
		return NextResponse.json({ error: "Confirmation failed." }, { status: 500 });
	}

	return NextResponse.json({ received: true });
}
