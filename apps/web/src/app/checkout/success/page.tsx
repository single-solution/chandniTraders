import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { orderPaymentToCheckoutId } from "@store/shared";

import { CheckoutSuccess } from "@/app/checkout/_components/CheckoutSuccess";
import { auth } from "@/lib/auth";
import { getAccountOrder } from "@/lib/core/account";

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

	const session = await auth();
	if (!session?.user || session.user.role !== "customer" || !session.user.customerId) {
		if (orderNumber) {
			redirect(`/account/sign-in?next=${encodeURIComponent(`/checkout/success?order=${encodeURIComponent(orderNumber)}`)}`);
		}
		redirect("/account/sign-in");
	}

	if (!orderNumber) {
		redirect("/account#orders");
	}

	const order = await getAccountOrder(session.user.customerId, orderNumber);
	if (!order) {
		redirect("/account#orders");
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
