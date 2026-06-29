import type { Metadata } from "next";
import { Cart } from "@/app/cart/_components/Cart";

export const metadata: Metadata = {
	title: "Cart",
	description: "Review the items in your cart before heading to checkout.",
};

export default function CartPage() {
	return <Cart />;
}
