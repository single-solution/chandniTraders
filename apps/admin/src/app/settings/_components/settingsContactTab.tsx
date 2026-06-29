"use client";

import { useMemo } from "react";
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { STORE_SETTING_GROUPS, isValidWhatsappNumber, normalizeWhatsappNumber } from "@store/shared";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { FormGrid, SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

export function ContactSettings({ draft, saved, setField, onSaved, canUpdate }: SectionProps) {
	const fields = useMemo(() => [...STORE_SETTING_GROUPS.contact, ...STORE_SETTING_GROUPS.address], []);
	const phoneClean = draft.supportPhone.replace(/[^\d+]/g, "");
	const wa = normalizeWhatsappNumber(draft.whatsappNumber);
	const whatsappInvalid = wa.length > 0 && !isValidWhatsappNumber(wa);
	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Support phone",
			value: draft.supportPhone || "Not set",
			tone: draft.supportPhone ? "good" : "warn",
			icon: Phone,
		},
		{
			label: "Customer WhatsApp",
			value: draft.whatsappNumber || "Not set",
			tone: wa ? (whatsappInvalid ? "warn" : "good") : "warn",
			icon: MessageCircle,
		},
		{
			label: "Email",
			value: draft.supportEmail || "Not set",
			tone: draft.supportEmail ? "good" : "warn",
			icon: Mail,
		},
		{
			label: "Outlet",
			value: draft.storeAddressLine1 || "Not set",
			hint: draft.storeAddressLine2 || undefined,
			tone: draft.storeAddressLine1 ? "good" : "neutral",
			icon: MapPin,
		},
	];
	return (
		<SaveableSection
			fields={fields}
			draft={draft}
			saved={saved}
			setField={setField}
			onSaved={onSaved}
			canUpdate={canUpdate}
			hero={
				<SettingsTabHero
					metrics={heroMetrics}
					actions={
						<>
							{phoneClean ? (
								<a
									href={`tel:${phoneClean}`}
									className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-accent-300)] hover:text-[var(--color-accent-800)]"
								>
									<Phone size={13} /> Test call
								</a>
							) : null}
							{wa ? (
								<a
									href={`https://wa.me/${wa}`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-accent-300)] hover:text-[var(--color-accent-800)]"
								>
									<MessageCircle size={13} /> Test WhatsApp
									<ExternalLink size={11} className="opacity-60" />
								</a>
							) : null}
							{draft.supportEmail ? (
								<a
									href={`mailto:${draft.supportEmail}`}
									className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-accent-300)] hover:text-[var(--color-accent-800)]"
								>
									<Mail size={13} /> Send test email
								</a>
							) : null}
						</>
					}
				/>
			}
		>
			<FormSection title="Store contact" description="Support phone is for calls. WhatsApp number is separate — customer chat links only (footer, PDP, orders). Staff alert numbers live under Integrations.">
				<FormGrid cols={3}>
					<TextField
						label="Support phone"
						value={draft.supportPhone}
						onChange={(event) => setField("supportPhone", event.target.value)}
						placeholder="+92 320 4862403"
						inputMode="tel"
						autoComplete="tel"
						hint="Callers reach this for sales and support. Not used for WhatsApp chat links."
						leadingIcon={<Phone size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Landline"
						value={draft.supportLandline}
						onChange={(event) => setField("supportLandline", event.target.value)}
						placeholder="042 35711234"
						inputMode="tel"
						leadingIcon={<Phone size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Support email"
						type="email"
						value={draft.supportEmail}
						onChange={(event) => setField("supportEmail", event.target.value)}
						placeholder="support@yourstore.com"
						inputMode="email"
						autoComplete="email"
						leadingIcon={<Mail size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Customer WhatsApp number"
						value={draft.whatsappNumber}
						onChange={(event) => setField("whatsappNumber", event.target.value)}
						placeholder="923204862403"
						inputMode="tel"
						hint="Storefront chat only — separate from support phone and from staff WhatsApp in Integrations. Footer chat button appears when this is valid."
						errorText={whatsappInvalid ? "Use 10–15 digits (e.g. 923204862403)." : undefined}
						leadingIcon={<MessageCircle size={14} />}
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			<FormSection title="Outlet address" description="Address shown on the about page and in the footer.">
				<FormGrid cols={3}>
					<TextField
						label="Address line 1"
						value={draft.storeAddressLine1}
						onChange={(event) => setField("storeAddressLine1", event.target.value)}
						placeholder="Shop 12, Main Boulevard"
						autoComplete="address-line1"
						leadingIcon={<MapPin size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Address line 2"
						value={draft.storeAddressLine2}
						onChange={(event) => setField("storeAddressLine2", event.target.value)}
						placeholder="Area, City"
						autoComplete="address-line2"
						leadingIcon={<MapPin size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Store hours"
						value={draft.storeHours}
						onChange={(event) => setField("storeHours", event.target.value)}
						placeholder="Mon–Sat · 11am – 10pm"
						hint="Shown in the footer and About page."
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>
		</SaveableSection>
	);
}
