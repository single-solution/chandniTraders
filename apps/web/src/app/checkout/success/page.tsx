import type { Metadata } from "next";
import { redirect } from "next/navigation";

import type { Types } from "mongoose";
import { connectDB, Order as OrderModel, type OrderAttributes } from "@store/db";
import { orderPaymentToCheckoutId } from "@store/shared";

import { CheckoutSuccess } from "@/app/checkout/_components/CheckoutSuccess";
import { auth } from "@/lib/auth";
import { getAccountOrder } from "@/lib/core/account";
import { toOrder, type Order } from "@/lib/core/orderSerializer";

export const metadata: Metadata = {
	title: "Order placed",
	description: "Your order details and next steps.",
};

export const dynamic = "force-dynamic";

interface CheckoutSuccessPageProps {
	searchParams: Promise<{
		order?: string | string[];
	}>;
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
	const params = await searchParams;
	const orderNumber = typeof params.order === "string" ? params.order.trim() : "";

	if (!orderNumber) {
		redirect("/");
	}

	const session = await auth();
	let order: Order | null = null;
	if (session?.user && session.user.role === "customer" && session.user.customerId) {
		order = await getAccountOrder(session.user.customerId, orderNumber);
	} else {
		await connectDB();
		const orderDoc = await OrderModel.findOne({ orderNumber }).lean<OrderAttributes & { _id: Types.ObjectId }>();
		if (orderDoc) {
			order = toOrder(orderDoc);
		}
	}

	if (!order) {
		redirect("/");
	}

	return (
		<CheckoutSuccess
			orderNumber={order.orderNumber}
			payment={orderPaymentToCheckoutId(order.payment) ?? order.payment}
			totalRupees={order.totals.totalRupees}
			pointsEarned={order.pointsEarned}
			pointsRedeemed={order.pointsRedeemed}
			orderStatus={order.status}
		/>
	);
}
