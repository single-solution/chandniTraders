"use client";

import { FileText, ShieldCheck } from "lucide-react";
import { STORE_SETTING_GROUPS } from "@store/shared";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid, SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { NumberField, SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import { PolicyDocumentEditors } from "@/app/settings/_components/PolicyDocumentEditors";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

export function PolicySettings({ draft, saved, setField, onSaved, canUpdate }: SectionProps) {
	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Moneyback window",
			value: `${draft.moneybackDays} days`,
			hint: "Customers can request a refund within this period",
			tone: draft.moneybackDays > 0 ? "good" : "warn",
			icon: ShieldCheck,
		},
		{
			label: "Default warranty",
			value: `${draft.defaultWarrantyMonths} months`,
			hint: "Used when a product doesn't override its warranty",
			tone: draft.defaultWarrantyMonths > 0 ? "good" : "warn",
			icon: ShieldCheck,
		},
		{
			label: "Return policy",
			value: draft.returnPolicyHtml.trim() ? "Published" : "Empty",
			hint: "Opens in a checkout modal",
			tone: draft.returnPolicyHtml.trim() ? "good" : "warn",
			icon: FileText,
		},
		{
			label: "Privacy policy",
			value: draft.privacyPolicyHtml.trim() ? "Published" : "Empty",
			hint: "Opens in a checkout modal",
			tone: draft.privacyPolicyHtml.trim() ? "good" : "warn",
			icon: FileText,
		},
	];
	return (
		<SaveableSection
			fields={STORE_SETTING_GROUPS.policy}
			draft={draft}
			saved={saved}
			setField={setField}
			onSaved={onSaved}
			canUpdate={canUpdate}
			hero={<SettingsTabHero metrics={heroMetrics} />}
		>
			<FormSection title="Customer policies" description="Policy values surfaced on product pages, FAQs and dispatch confirmations.">
				<FormGrid>
					<NumberField
						label="Moneyback window (days)"
						value={draft.moneybackDays}
						onChange={(value) => setField("moneybackDays", value)}
						placeholder="e.g. 7"
						hint="Number of days a customer can request a refund after delivery."
						disabled={!canUpdate}
						containerClassName="w-full"
					/>
					<NumberField
						label="Default warranty (months)"
						value={draft.defaultWarrantyMonths}
						onChange={(value) => setField("defaultWarrantyMonths", value)}
						placeholder="e.g. 12"
						hint="Used when a product doesn't override its warranty."
						disabled={!canUpdate}
						containerClassName="w-full"
					/>
				</FormGrid>
			</FormSection>

			<FormSection
				title="Legal copy for checkout"
				description="Return and privacy policies open in modals from checkout — no separate storefront pages. Use the rich editor for headings, lists, and links."
			>
				<PolicyDocumentEditors draft={draft} setField={setField} canUpdate={canUpdate} />
			</FormSection>
		</SaveableSection>
	);
}
