import { claimOrderStatusTransition, connectDB, fireOrderEventNotifications, Order as OrderModel } from "@store/db";
import { logger } from "@store/shared";

export interface ConfirmOnlinePaymentInput {
	orderId?: string;
	orderNumber?: string;
	gatewayProvider: "payfast" | "rapid-gateway";
	gatewayPaymentRef?: string;
	timelineNote?: string;
	/** Must match order total (whole rupees) before confirming. */
	paidAmountRupees?: number;
}

/** Mark a pending card order paid after PK gateway confirmation. Idempotent. */
export async function confirmOrderPaidOnline(input: ConfirmOnlinePaymentInput): Promise<{
	confirmed: boolean;
	orderNumber?: string;
	status?: string;
}> {
	const orderId = input.orderId?.trim();
	const orderNumber = input.orderNumber?.trim();

	if (!orderId && !orderNumber) {
		return { confirmed: false };
	}

	if (input.paidAmountRupees === undefined) {
		logger.error({ orderId, orderNumber, gatewayProvider: input.gatewayProvider }, "Gateway payment missing amount — order not confirmed");
		return { confirmed: false, orderNumber };
	}

	await connectDB();
	const order = orderId ? await OrderModel.findById(orderId) : await OrderModel.findOne({ orderNumber });

	if (!order) {
		logger.warn({ orderId, orderNumber }, "Gateway payment references missing order");
		return { confirmed: false };
	}

	if (order.status !== "pending-payment" || order.payment !== "card") {
		return {
			confirmed: true,
			orderNumber: order.orderNumber,
			status: order.status,
		};
	}

	const expectedTotalRupees = Math.round(order.totals?.totalRupees ?? 0);
	const paidRupees = Math.round(input.paidAmountRupees);
	if (paidRupees !== expectedTotalRupees) {
		logger.error(
			{ orderNumber: order.orderNumber, expectedTotalRupees, paidRupees, gatewayProvider: input.gatewayProvider },
			"Gateway payment amount mismatch — order not confirmed",
		);
		return { confirmed: false, orderNumber: order.orderNumber, status: order.status };
	}

	const timelineNote =
		input.timelineNote?.trim() ||
		(input.gatewayProvider === "payfast"
			? "Online payment received via PayFast."
			: "Online payment received via Rapid Gateway.");

	const claimed = await claimOrderStatusTransition({
		orderId: order._id,
		fromStatuses: ["pending-payment"],
		toStatus: "confirmed",
		timelineNote,
		additionalFilter: { payment: "card" },
		additionalSet: {
			gatewayProvider: input.gatewayProvider,
			...(input.gatewayPaymentRef?.trim() ? { gatewayPaymentRef: input.gatewayPaymentRef.trim() } : {}),
		},
	});

	if (!claimed) {
		const current = await OrderModel.findById(order._id).lean<{ status?: string; orderNumber?: string }>();
		if (current && current.status !== "pending-payment") {
			return {
				confirmed: true,
				orderNumber: current.orderNumber,
				status: current.status,
			};
		}
		return { confirmed: false, orderNumber: order.orderNumber, status: order.status };
	}

	void fireOrderEventNotifications({
		event: "payment_confirmed",
		order: claimed,
		previousStatus: "pending-payment",
		nextStatus: "confirmed",
	}).catch((error) => {
		logger.warn({ error, orderNumber: claimed.orderNumber }, "Payment-confirmed notifications failed");
	});

	return {
		confirmed: true,
		orderNumber: claimed.orderNumber,
		status: claimed.status,
	};
}
