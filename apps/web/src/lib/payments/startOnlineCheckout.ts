import type { IntegrationSettingsValues } from "@store/shared";

import { createPayFastHostedCheckout, type PayFastFormCheckoutResult } from "@/lib/payments/payfastCheckout";
import { createRapidGatewayCheckout, type RapidGatewayRedirectCheckoutResult } from "@/lib/payments/rapidGatewayCheckout";

export type OnlineCheckoutLaunch = PayFastFormCheckoutResult | RapidGatewayRedirectCheckoutResult;

export interface StartOnlineCheckoutInput {
	order: {
		_id: { toString(): string };
		orderNumber: string;
		totals?: { totalRupees?: number };
		customerSnapshot?: { phoneNumber?: string };
		save(): Promise<unknown>;
	};
	integration: IntegrationSettingsValues;
	storeName: string;
	publicSiteUrl: string;
	customerEmail?: string;
}

export async function startOrderOnlineCheckout(input: StartOnlineCheckoutInput): Promise<OnlineCheckoutLaunch> {
	const provider = input.integration.onlinePaymentProvider;
	const totalRupees = input.order.totals?.totalRupees ?? 0;
	const customerPhone = input.order.customerSnapshot?.phoneNumber;

	if (provider === "payfast") {
		const checkout = await createPayFastHostedCheckout({
			settings: input.integration,
			orderId: input.order._id.toString(),
			orderNumber: input.order.orderNumber,
			totalRupees,
			storeName: input.storeName,
			publicSiteUrl: input.publicSiteUrl,
			customerEmail: input.customerEmail,
			customerPhone,
		});

		(input.order as { gatewayPaymentRef?: string; gatewayProvider?: string }).gatewayPaymentRef = checkout.paymentRef;
		(input.order as { gatewayProvider?: string }).gatewayProvider = "payfast";
		await input.order.save();
		return checkout;
	}

	if (provider === "rapid-gateway") {
		const checkout = await createRapidGatewayCheckout({
			settings: input.integration,
			orderId: input.order._id.toString(),
			orderNumber: input.order.orderNumber,
			totalRupees,
			publicSiteUrl: input.publicSiteUrl,
			customerPhone,
		});

		(input.order as { gatewayPaymentRef?: string; gatewayProvider?: string }).gatewayPaymentRef = checkout.paymentRef;
		(input.order as { gatewayProvider?: string }).gatewayProvider = "rapid-gateway";
		await input.order.save();
		return checkout;
	}

	throw new Error("No online payment provider is configured.");
}

export function toOnlineCheckoutApiResponse(launch: OnlineCheckoutLaunch) {
	if (launch.mode === "redirect") {
		return { checkoutUrl: launch.checkoutUrl };
	}
	return {
		checkoutForm: {
			postUrl: launch.postUrl,
			fields: launch.fields,
		},
	};
}
