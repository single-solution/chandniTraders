import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrderDetail } from "@/app/account/_components/OrderDetail";
import { auth } from "@/lib/auth";
import { getAccountOrder } from "@/lib/core/account";

interface OrderDetailPageProps {
	params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: `Order ${id}`,
		description: `Track your order ${id}.`,
	};
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
	const { id } = await params;
	const session = await auth();
	if (!session?.user || session.user.role !== "customer" || !session.user.customerId) {
		redirect("/account/sign-out");
	}
	const order = await getAccountOrder(session.user.customerId, id);
	if (!order) {
		notFound();
	}
	return <OrderDetail order={order} />;
}
