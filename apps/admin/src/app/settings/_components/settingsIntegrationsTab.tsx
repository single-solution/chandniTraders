"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudUpload, CreditCard, Gauge, MapPin, MessageCircle, Share2, Sparkles, Video } from "lucide-react";
import { STORE_SETTING_GROUPS, type OtpIntegrationStatus, type OnlinePaymentIntegrationStatus, type StorageIntegrationStatus } from "@store/shared";
import { apiFetch } from "@/lib/api";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { FormGrid, SettingsTabHero, type SettingsHeroMetric, type SettingsHeroMetricTone } from "@/app/settings/_components/settingsWorkspaceUi";
import { SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import { IntegrationCredentialsPanel } from "@/app/settings/_components/integrationCredentialsPanel";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

const META_PIXEL_PATTERN = /^\d{6,20}$/;
const GA4_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const GTM_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const TIKTOK_PATTERN = /^[A-Z0-9]{16,40}$/;

function pixelStatus(value: string, pattern: RegExp): { tone: SettingsHeroMetricTone; label: string; validation?: string } {
	const trimmed = value.trim();
	if (!trimmed) {
		return { tone: "off", label: "Off" };
	}
	if (!pattern.test(trimmed)) {
		return { tone: "warn", label: "Invalid", validation: "Format doesn't match — pixel won't load." };
	}
	return { tone: "good", label: "Active" };
}

export function IntegrationsSettings({ draft, saved, setField, onSaved, canUpdate }: SectionProps) {
	const fields = useMemo(() => [...STORE_SETTING_GROUPS.social, ...STORE_SETTING_GROUPS.marketing], []);
	const [otpStatus, setOtpStatus] = useState<OtpIntegrationStatus | null>(null);
	const [storageStatus, setStorageStatus] = useState<StorageIntegrationStatus | null>(null);
	const [onlinePaymentStatus, setOnlinePaymentStatus] = useState<OnlinePaymentIntegrationStatus | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function loadStatus() {
			try {
				const data = await apiFetch<{ otp: OtpIntegrationStatus; storage: StorageIntegrationStatus; onlinePayment: OnlinePaymentIntegrationStatus }>(
					"/api/settings/integrations-status",
				);
				if (!cancelled) {
					setOtpStatus(data.otp);
					setStorageStatus(data.storage);
					setOnlinePaymentStatus(data.onlinePayment);
				}
			} catch {
				// Status panel is informational — tab still works without it.
			}
		}
		void loadStatus();
		return () => {
			cancelled = true;
		};
	}, []);

	const socialLinks = [draft.socialFacebook, draft.socialInstagram, draft.socialTiktok, draft.socialYoutube, draft.socialGoogleMaps];
	const linkedCount = socialLinks.filter((value) => value.trim().length > 0).length;

	const meta = pixelStatus(draft.metaPixelId, META_PIXEL_PATTERN);
	const ga = pixelStatus(draft.googleAnalyticsId, GA4_PATTERN);
	const gtm = pixelStatus(draft.googleTagManagerId, GTM_PATTERN);
	const tiktok = pixelStatus(draft.tiktokPixelId, TIKTOK_PATTERN);

	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Social profiles",
			value: linkedCount > 0 ? `${linkedCount} of 5 linked` : "None linked",
			hint: "Shown in the footer and About page",
			tone: linkedCount > 0 ? "good" : "off",
			icon: Share2,
		},
		{ label: "Meta Pixel", value: meta.label, tone: meta.tone, icon: Share2 },
		{ label: "Google Analytics 4", value: ga.label, tone: ga.tone, icon: Gauge },
		{ label: "Tag Manager", value: gtm.label, tone: gtm.tone, icon: Gauge },
		{ label: "TikTok Pixel", value: tiktok.label, tone: tiktok.tone, icon: Sparkles },
		{
			label: "Online payments",
			value:
				onlinePaymentStatus?.ready
					? onlinePaymentStatus.provider === "payfast"
						? "PayFast ready"
						: "Rapid ready"
					: onlinePaymentStatus?.provider === "none"
						? "Off"
						: "Setup",
			hint: onlinePaymentStatus?.summary,
			tone: onlinePaymentStatus?.ready ? "good" : onlinePaymentStatus?.provider === "none" ? "off" : "warn",
			icon: CreditCard,
		},
		{
			label: "Sign-in OTP",
			value:
				otpStatus?.readyForProduction && otpStatus.activeProvider === "whatsapp-cloud"
					? "Meta WhatsApp ready"
					: otpStatus?.activeProvider === "whatsapp-cloud"
						? "Meta partial"
						: "Console (dev)",
			hint: otpStatus?.summary,
			tone: otpStatus?.readyForProduction ? "good" : otpStatus?.activeProvider === "console" ? "off" : "warn",
			icon: MessageCircle,
		},
		{
			label: "Media storage",
			value: storageStatus?.ready ? "Ready" : storageStatus?.provider === "s3" ? "S3 incomplete" : "Token missing",
			hint: storageStatus?.summary,
			tone: storageStatus?.ready ? "good" : "warn",
			icon: CloudUpload,
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
					description="Social profiles, tracking pixels, and server credentials (PayFast, Rapid Gateway, WhatsApp OTP, email, storage). Manage secrets below — no developer needed for routine changes."
					metrics={heroMetrics}
				/>
			}
		>
			<IntegrationCredentialsPanel canUpdate={canUpdate} />

			<FormSection title="Social profiles" description="Linked from the footer and About page. Leave a row blank to hide that platform.">
				<FormGrid cols={3}>
					<TextField
						label="Facebook URL"
						type="url"
						value={draft.socialFacebook}
						onChange={(event) => setField("socialFacebook", event.target.value)}
						placeholder="https://facebook.com/yourstore"
						inputMode="url"
						leadingIcon={<Share2 size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Instagram URL"
						type="url"
						value={draft.socialInstagram}
						onChange={(event) => setField("socialInstagram", event.target.value)}
						placeholder="https://instagram.com/yourstore"
						inputMode="url"
						leadingIcon={<Share2 size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="TikTok URL"
						type="url"
						value={draft.socialTiktok}
						onChange={(event) => setField("socialTiktok", event.target.value)}
						placeholder="https://tiktok.com/@yourstore"
						inputMode="url"
						leadingIcon={<Sparkles size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="YouTube URL"
						type="url"
						value={draft.socialYoutube}
						onChange={(event) => setField("socialYoutube", event.target.value)}
						placeholder="https://youtube.com/@yourstore"
						inputMode="url"
						leadingIcon={<Video size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Google Maps URL"
						type="url"
						value={draft.socialGoogleMaps}
						onChange={(event) => setField("socialGoogleMaps", event.target.value)}
						placeholder="https://goo.gl/maps/…"
						hint="Powers the 'Get directions' link on the About page."
						inputMode="url"
						leadingIcon={<MapPin size={14} />}
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			<FormSection title="Tracking pixels" description="Paste each ID from its respective console. The storefront only loads pixels with valid IDs.">
				<FormGrid cols={3}>
					<TextField
						label="Meta (Facebook) Pixel ID"
						value={draft.metaPixelId}
						onChange={(event) => setField("metaPixelId", event.target.value)}
						placeholder="e.g. 123456789012345"
						inputMode="numeric"
						hint="6–20 digits. Events Manager → Data sources."
						errorText={meta.validation}
						disabled={!canUpdate}
					/>
					<TextField
						label="Google Analytics 4 ID"
						value={draft.googleAnalyticsId}
						onChange={(event) => setField("googleAnalyticsId", event.target.value.toUpperCase())}
						placeholder="G-XXXXXXXXXX"
						hint="G- followed by 4–20 letters/digits."
						errorText={ga.validation}
						disabled={!canUpdate}
					/>
					<TextField
						label="Google Tag Manager ID"
						value={draft.googleTagManagerId}
						onChange={(event) => setField("googleTagManagerId", event.target.value.toUpperCase())}
						placeholder="GTM-XXXXXXX"
						hint="Use this to drive tags through GTM instead."
						errorText={gtm.validation}
						disabled={!canUpdate}
					/>
					<TextField
						label="TikTok Pixel ID"
						value={draft.tiktokPixelId}
						onChange={(event) => setField("tiktokPixelId", event.target.value.toUpperCase())}
						placeholder="e.g. CXXXXXXXXXXXXXXXX"
						hint="16–40 alphanumeric characters."
						errorText={tiktok.validation}
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>
		</SaveableSection>
	);
}
