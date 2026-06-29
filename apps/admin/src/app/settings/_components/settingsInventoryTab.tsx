"use client";

import { AlertCircle, Package } from "lucide-react";
import { STORE_SETTING_GROUPS } from "@store/shared";
import { FormSection } from "@/components/forms/FormSection";
import { SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { NumberField, SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

export function InventorySettings({ draft, saved, setField, onSaved, canUpdate }: SectionProps) {
	const threshold = Math.max(0, Math.floor(draft.lowStockThreshold));
	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Low-stock alert at",
			value: threshold === 0 ? "Disabled" : `≤ ${threshold} units`,
			hint: threshold === 0 ? "Bell-menu and KPI alerts are silenced" : "Variants at or below this trigger alerts",
			tone: threshold === 0 ? "off" : "good",
			icon: Package,
		},
		{
			label: "Where it shows",
			value: "Dashboard + bell",
			hint: "Low-stock KPI · notification dropdown",
			tone: "neutral",
			icon: AlertCircle,
		},
	];
	return (
		<SaveableSection
			fields={STORE_SETTING_GROUPS.inventory}
			draft={draft}
			saved={saved}
			setField={setField}
			onSaved={onSaved}
			canUpdate={canUpdate}
			hero={<SettingsTabHero metrics={heroMetrics} />}
		>
			<FormSection title="Stock alerts" description="Variants with active stock at or below this number show up in the dashboard 'Low stock' KPI and the bell-menu warning.">
				<NumberField
					label="Low-stock threshold"
					value={draft.lowStockThreshold}
					onChange={(value) => setField("lowStockThreshold", value)}
					trailingAddon="units"
					placeholder="e.g. 2"
					hint="Set to 0 to silence low-stock alerts entirely."
					disabled={!canUpdate}
				/>
			</FormSection>
		</SaveableSection>
	);
}
