/**
 * Checkout / order payment copy — maps UI payment chips to API values and
 * builds customer-facing “what to do next” steps after placing an order.
 */

import { formatPrice } from "../formatters";
import type { PaymentMethodId } from "../constants";

/** Values persisted on `Order.payment` (matches `@store/db`). */
export const ORDER_PAYMENT_METHODS = ["bank-transfer", "cod", "card"] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export const CHECKOUT_TO_ORDER_PAYMENT: Record<PaymentMethodId, OrderPaymentMethod> = {
	"bank-transfer": "bank-transfer",
	card: "card",
	cod: "cod",
};

export const ORDER_TO_CHECKOUT_PAYMENT: Partial<Record<OrderPaymentMethod, PaymentMethodId>> = {
	"bank-transfer": "bank-transfer",
	card: "card",
	cod: "cod",
};

export function orderPaymentToCheckoutId(payment: OrderPaymentMethod): PaymentMethodId | undefined {
	return ORDER_TO_CHECKOUT_PAYMENT[payment];
}

export function isOrderPaymentMethod(value: string): value is OrderPaymentMethod {
	return (ORDER_PAYMENT_METHODS as readonly string[]).includes(value);
}

export interface BankTransferDetails {
	bankName: string;
	accountTitle: string;
	accountNumber: string;
	iban?: string;
}

export interface PaymentInstructionCopy {
	title: string;
	steps: readonly string[];
	whatsappPrefill: string;
}

export interface PaymentInstructionsInput {
	payment: OrderPaymentMethod;
	orderNumber: string;
	totalRupees: number;
	supportPhone: string;
	bankTransfer?: BankTransferDetails;
	/** Card only — false while order is still `pending-payment`. Defaults to true. */
	isPaymentComplete?: boolean;
}

function formatBankLines(bank?: BankTransferDetails): string {
	if (!bank?.accountNumber?.trim() && !bank?.iban?.trim()) {
		return "";
	}
	const lines = [
		bank.bankName?.trim() ? `Bank: ${bank.bankName.trim()}` : "",
		bank.accountTitle?.trim() ? `Account title: ${bank.accountTitle.trim()}` : "",
		bank.accountNumber?.trim() ? `Account number: ${bank.accountNumber.trim()}` : "",
		bank.iban?.trim() ? `IBAN: ${bank.iban.trim()}` : "",
	].filter(Boolean);
	return lines.join(" · ");
}

export function buildPaymentInstructions(input: PaymentInstructionsInput): PaymentInstructionCopy {
	const totalLabel = formatPrice(input.totalRupees);
	const orderRef = input.orderNumber;
	const whatsappBase = `Salam! I placed order ${orderRef} (${totalLabel}).`;
	const isPaymentComplete = input.isPaymentComplete ?? true;
	const bankLine = formatBankLines(input.bankTransfer);

	switch (input.payment) {
		case "bank-transfer":
			return {
				title: isPaymentComplete ? "Bank transfer received" : "Pay by bank transfer",
				steps: isPaymentComplete
					? [
							`We received your transfer of ${totalLabel} for order ${orderRef}.`,
							"Your order is confirmed — we'll start packing soon.",
							`Questions? WhatsApp us at ${input.supportPhone} with order ${orderRef}.`,
						]
					: [
							`Transfer exactly ${totalLabel} to our account${bankLine ? `: ${bankLine}` : " — WhatsApp us if you need the details."}`,
							`Send a clear payment screenshot on WhatsApp with order number ${orderRef}.`,
							"We confirm within a few hours once the transfer matches your order.",
						],
				whatsappPrefill: `${whatsappBase} Here is my bank transfer payment screenshot.`,
			};
		case "card":
			if (!isPaymentComplete) {
				return {
					title: "Complete card payment",
					steps: [
						`Your order ${orderRef} is reserved — pay ${totalLabel} on the secure checkout page.`,
						"We confirm automatically as soon as payment succeeds.",
						`Need help? WhatsApp us at ${input.supportPhone} with order ${orderRef}.`,
					],
					whatsappPrefill: `${whatsappBase} I need help completing my card payment.`,
				};
			}
			return {
				title: "Card payment received",
				steps: [
					`Your payment of ${totalLabel} was processed securely.`,
					`Order ${orderRef} is confirmed — we'll start packing soon.`,
					`Questions? WhatsApp us at ${input.supportPhone} with order ${orderRef}.`,
				],
				whatsappPrefill: `${whatsappBase} I'd like an update on my paid card order.`,
			};
		case "cod":
			return {
				title: "Cash on delivery",
				steps: [
					`Keep ${totalLabel} ready — we confirm the exact amount before dispatch.`,
					orderRef ? `Quote order ${orderRef} when our team calls or when you receive the parcel.` : "Quote your order number when our team calls.",
					"Pay in cash when the order is handed over.",
				],
				whatsappPrefill: `${whatsappBase} I'd like to confirm cash on delivery.`,
			};
		default: {
			const exhaustive: never = input.payment;
			return exhaustive;
		}
	}
}
