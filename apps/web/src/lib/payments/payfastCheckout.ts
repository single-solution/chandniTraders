import { createHash, timingSafeEqual } from "node:crypto";

import { resolvePublicSiteUrl, type IntegrationSettingsValues } from "@store/shared";

const PAYFAST_SANDBOX_BASE = "https://ipguat.apps.net.pk/Ecommerce/api/Transaction";
const PAYFAST_LIVE_BASE = "https://ipg1.apps.net.pk/Ecommerce/api/Transaction";

export interface PayFastCheckoutInput {
	settings: IntegrationSettingsValues;
	orderId: string;
	orderNumber: string;
	totalRupees: number;
	storeName: string;
	publicSiteUrl: string;
	customerEmail?: string;
	customerPhone?: string;
}

export interface PayFastFormCheckoutResult {
	mode: "form";
	postUrl: string;
	fields: Record<string, string>;
	paymentRef: string;
}

function payFastApiBase(settings: IntegrationSettingsValues): string {
	return settings.payfastSandbox ? PAYFAST_SANDBOX_BASE : PAYFAST_LIVE_BASE;
}

function formatPayFastAmount(rupees: number): string {
	return Math.max(0, Math.round(rupees)).toString();
}

function formatOrderDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

function buildPayFastSignature(merchantId: string, merchantName: string, amount: string, basketId: string): string {
	return createHash("md5").update(`${merchantId}:${merchantName}:${amount}:${basketId}`).digest("hex");
}

async function fetchPayFastAccessToken(
	settings: IntegrationSettingsValues,
	input: { basketId: string; amount: string; customerIp: string },
): Promise<string> {
	const merchantId = settings.payfastMerchantId.trim();
	const securedKey = settings.payfastSecuredKey.trim();
	if (!merchantId || !securedKey) {
		throw new Error("PayFast credentials are not configured.");
	}

	const apiBase = payFastApiBase(settings);
	const body = new URLSearchParams({
		merchant_id: merchantId,
		secured_key: securedKey,
		grant_type: "client_credentials",
		customer_ip: input.customerIp,
	});

	const response = await fetch(`${apiBase}/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		throw new Error("PayFast token request failed.");
	}

	const payload = (await response.json()) as { token?: string; access_token?: string };
	const token = payload.token?.trim() || payload.access_token?.trim();
	if (!token) {
		throw new Error("PayFast did not return an access token.");
	}

	return token;
}

/** PayFast hosted checkout — form POST to PayFast gateway. */
export async function createPayFastHostedCheckout(
	input: PayFastCheckoutInput,
	customerIp = "127.0.0.1",
): Promise<PayFastFormCheckoutResult> {
	const merchantId = input.settings.payfastMerchantId.trim();
	const merchantName = (input.settings.payfastMerchantName.trim() || input.storeName).slice(0, 120);
	const basketId = input.orderNumber;
	const amount = formatPayFastAmount(input.totalRupees);
	const orderDate = formatOrderDate(new Date());
	const storefrontBase = resolvePublicSiteUrl(input.publicSiteUrl) || process.env.AUTH_URL?.trim() || "http://localhost:3000";
	const base = storefrontBase.replace(/\/$/, "");

	const successUrl = `${base}/api/payments/callback/payfast?order=${encodeURIComponent(input.orderNumber)}`;
	const failureUrl = `${base}/checkout?cancelled=1&order=${encodeURIComponent(input.orderNumber)}`;
	const checkoutUrl = `${base}/checkout/success?order=${encodeURIComponent(input.orderNumber)}`;

	const token = await fetchPayFastAccessToken(input.settings, {
		basketId,
		amount,
		customerIp,
	});

	const signature = buildPayFastSignature(merchantId, merchantName, amount, basketId);
	const apiBase = payFastApiBase(input.settings);

	return {
		mode: "form",
		postUrl: `${apiBase}/PostTransaction`,
		paymentRef: basketId,
		fields: {
			CURRENCY_CODE: "586",
			MERCHANT_ID: merchantId,
			MERCHANT_NAME: merchantName,
			TOKEN: token,
			BASKET_ID: basketId,
			TXNAMT: amount,
			ORDER_DATE: orderDate,
			SUCCESS_URL: successUrl,
			FAILURE_URL: failureUrl,
			CHECKOUT_URL: checkoutUrl,
			CUSTOMER_EMAIL_ADDRESS: input.customerEmail?.trim() || "customer@store.pk",
			CUSTOMER_MOBILE_NO: input.customerPhone?.trim() || "",
			SIGNATURE: signature,
			VERSION: "MERCHANTCART-0.1",
			PROCCODE: "00",
			TRAN_TYPE: "ECOMM_PURCHASE",
			"Item Description": `Order ${input.orderNumber}`,
		},
	};
}

/** Verify PayFast return/IPN hash: basket_id|secured_key|merchant_id|err_code */
export function verifyPayFastCallbackHash(
	settings: IntegrationSettingsValues,
	basketId: string,
	errCode: string,
	receivedHash: string,
): boolean {
	const securedKey = settings.payfastSecuredKey.trim();
	const merchantId = settings.payfastMerchantId.trim();
	if (!securedKey || !merchantId || !receivedHash.trim()) {
		return false;
	}

	const expected = createHash("sha256")
		.update(`${basketId}|${securedKey}|${merchantId}|${errCode}`)
		.digest("hex")
		.toUpperCase();

	const received = receivedHash.trim().toUpperCase();
	if (expected.length !== received.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function isPayFastPaymentSuccess(errCode: string): boolean {
	const normalized = errCode.trim();
	return normalized === "00" || normalized === "000" || normalized === "79";
}

/** Parse PayFast return/IPN amount (whole rupees). */
export function parsePayFastPaidAmountRupees(params: URLSearchParams): number | undefined {
	const raw = params.get("TXNAMT")?.trim() || params.get("txnamt")?.trim() || params.get("amount")?.trim();
	if (!raw) {
		return undefined;
	}
	const parsed = Math.round(Number(raw));
	return Number.isFinite(parsed) ? parsed : undefined;
}
