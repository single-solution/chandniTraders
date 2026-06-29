import { resolvePublicSiteUrl, type IntegrationSettingsValues } from "@store/shared";

const RAPID_SANDBOX_API = "https://sandbox.api.rapidgateway.pk/v1";
const RAPID_LIVE_API = "https://api.rapidgateway.pk/v1";

export interface RapidGatewayCheckoutInput {
	settings: IntegrationSettingsValues;
	orderId: string;
	orderNumber: string;
	totalRupees: number;
	publicSiteUrl: string;
	customerPhone?: string;
}

export interface RapidGatewayRedirectCheckoutResult {
	mode: "redirect";
	checkoutUrl: string;
	paymentRef: string;
}

function rapidApiBase(settings: IntegrationSettingsValues): string {
	return settings.rapidGatewaySandbox ? RAPID_SANDBOX_API : RAPID_LIVE_API;
}

export async function createRapidGatewayCheckout(input: RapidGatewayCheckoutInput): Promise<RapidGatewayRedirectCheckoutResult> {
	const secretKey = input.settings.rapidGatewaySecretKey.trim();
	if (!secretKey) {
		throw new Error("Rapid Gateway secret key is not configured.");
	}

	const storefrontBase = resolvePublicSiteUrl(input.publicSiteUrl) || process.env.AUTH_URL?.trim() || "http://localhost:3000";
	const base = storefrontBase.replace(/\/$/, "");
	const returnUrl = `${base}/checkout/success?order=${encodeURIComponent(input.orderNumber)}`;
	const webhookUrl = `${base}/api/webhooks/rapid-gateway`;

	const response = await fetch(`${rapidApiBase(input.settings)}/payments`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/json",
			"Idempotency-Key": input.orderId,
		},
		body: JSON.stringify({
			amount: Math.max(0, Math.round(input.totalRupees)),
			currency: "PKR",
			methods: ["card", "easypaisa", "jazzcash", "raast"],
			customer: {
				phone: input.customerPhone?.trim() || undefined,
			},
			metadata: {
				orderId: input.orderId,
				orderNumber: input.orderNumber,
			},
			return_url: returnUrl,
			webhook_url: webhookUrl,
		}),
	});

	if (!response.ok) {
		throw new Error("Rapid Gateway payment request failed.");
	}

	const payload = (await response.json()) as { id?: string; checkout_url?: string };
	if (!payload.checkout_url?.trim() || !payload.id?.trim()) {
		throw new Error("Rapid Gateway did not return a checkout URL.");
	}

	return {
		mode: "redirect",
		checkoutUrl: payload.checkout_url.trim(),
		paymentRef: payload.id.trim(),
	};
}
