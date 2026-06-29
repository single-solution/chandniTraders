"use client";

import { Truck } from "lucide-react";
import { FormSection } from "@/components/forms/FormSection";
import { SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { NumberField, SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

export function DeliverySettings({ draft, saved, setField, onSaved, canUpdate }: SectionProps) {
	const threshold = Math.max(0, Math.floor(draft.freeDeliveryThresholdRupees));
	const flatFee = Math.max(0, Math.floor(draft.courierFlatFeeRupees));
	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Courier fee",
			value: flatFee > 0 ? `Rs ${flatFee.toLocaleString("en-PK")}` : "Free",
			hint: "Charged when delivery is not waived",
			tone: flatFee > 0 ? "neutral" : "good",
			icon: Truck,
		},
		{
			label: "Free delivery from",
			value: threshold > 0 ? `Rs ${threshold.toLocaleString("en-PK")}+` : "Disabled",
			hint: threshold > 0 ? "Subtotal after offers at or above this ships free" : "Threshold off — only offers can waive delivery",
			tone: threshold > 0 ? "good" : "off",
			icon: Truck,
		},
	];
	return (
		<SaveableSection
			fields={["freeDeliveryThresholdRupees", "courierFlatFeeRupees"] as const}
			draft={draft}
			saved={saved}
			setField={setField}
			onSaved={onSaved}
			canUpdate={canUpdate}
			hero={<SettingsTabHero metrics={heroMetrics} />}
		>
			<FormSection title="Delivery rules" description="Applied at checkout for courier delivery. Offer free-shipping rules stack on top.">
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						label="Courier flat fee (Rs)"
						value={draft.courierFlatFeeRupees}
						onChange={(value) => setField("courierFlatFeeRupees", value)}
						trailingAddon="Rs"
						placeholder="e.g. 1500"
						hint="Charged when the cart is below the free-delivery threshold and no free-shipping offer applies."
						disabled={!canUpdate}
					/>
					<NumberField
						label="Free delivery over (Rs)"
						value={draft.freeDeliveryThresholdRupees}
						onChange={(value) => setField("freeDeliveryThresholdRupees", value)}
						trailingAddon="Rs"
						placeholder="e.g. 50000"
						hint="Subtotal after offers at or above this amount ships free. Set to 0 to disable threshold-based free delivery."
						disabled={!canUpdate}
					/>
				</div>
			</FormSection>
		</SaveableSection>
	);
}
