import type { Metadata } from "next";
import { Checkout } from "@/app/checkout/_components/Checkout";
import { auth } from "@/lib/auth";
import { getAccountCustomer } from "@/lib/core/account";

export const metadata: Metadata = {
	title: "Checkout",
	description: "Confirm your contact, address and payment to place your order.",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
	searchParams,
}: {
	searchParams: Promise<{ cancelled?: string; order?: string }>;
}) {
	const session = await auth();
	const params = await searchParams;
	const paymentCancelled = params.cancelled === "1";
	const cancelledOrderNumber = typeof params.order === "string" ? params.order.trim() : "";
	const customer = session?.user?.role === "customer" && session.user.customerId ? await getAccountCustomer(session.user.customerId) : null;

	return (
		<Checkout
			key={customer?.id ?? "guest"}
			customer={customer}
			paymentCancelled={paymentCancelled}
			cancelledOrderNumber={cancelledOrderNumber}
		/>
	);
}
