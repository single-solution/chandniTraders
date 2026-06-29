import { PackageOpen, ShieldCheck, ShoppingBag } from "lucide-react";
import type { ComponentType } from "react";
import type { StoreSettings } from "@store/shared";

type ProcessFlowKey = "store" | "order" | "return";

interface ProcessFlowStep {
	title: string;
	detail: string;
}

interface ProcessFlow {
	key: ProcessFlowKey;
	label: string;
	caption: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
	steps: ProcessFlowStep[];
}

/**
 * Three flows behind every order — what we do (store), what you do (order),
 * what we promise (return). Powers the unified `*ProcessSection` blocks.
 */
export function buildProcessFlows(settings: StoreSettings): ProcessFlow[] {
	return [
		{
			key: "store",
			label: "Store",
			caption: "How we stock",
			icon: PackageOpen,
			steps: [
				{ title: "Source", detail: "Stock from verified suppliers and authorised brand channels." },
				{ title: "Inspect", detail: "Every unit checked before it reaches the shelf or warehouse." },
				{ title: "List accurately", detail: "Specs, warranty, and price shown clearly on every product page." },
				{ title: "Ready to ship", detail: "Nationwide courier or in-store pickup from our Lahore locations." },
			],
		},
		{
			key: "order",
			label: "Order",
			caption: "How you buy",
			icon: ShoppingBag,
			steps: [
				{ title: "Pick", detail: "Browse by category, brand, size, or budget." },
				{ title: "Confirm & pay", detail: "Checkout with bank transfer, cash on delivery, or card — courier or store pickup." },
				{ title: "Ask first", detail: "Message us on WhatsApp for specs, availability, or bulk pricing." },
				{ title: "Dispatch", detail: "Same-day in Lahore where possible; 3–5 working days nationwide." },
			],
		},
		{
			key: "return",
			label: "Return",
			caption: "What we promise",
			icon: ShieldCheck,
			steps: [
				{
					title: `${settings.moneybackDays}-day moneyback`,
					detail: `Change your mind — full refund within ${settings.moneybackDays} days when the item is unused.`,
				},
				{ title: "Manufacturer warranty", detail: "Official warranty terms apply per product — shown on the product page." },
				{ title: "Support after sale", detail: "WhatsApp and phone support for delivery, warranty, and service questions." },
				{ title: "Not covered", detail: "Physical damage, misuse, unauthorised repairs, or missing accessories." },
			],
		},
	];
}
export type { ProcessFlow, ProcessFlowKey, ProcessFlowStep };
