"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import {
	type IntegrationSettingsValues,
	type OtpIntegrationStatus,
	type OnlinePaymentIntegrationStatus,
	type StorageIntegrationStatus,
} from "@store/shared";
import { apiFetch } from "@/lib/api";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@store/ui";
import { FormGrid } from "@/app/settings/_components/settingsWorkspaceUi";

interface IntegrationCredentialsPanelProps {
	canUpdate: boolean;
}

/** Host-env integrations (SMTP, R2). Ops fields for staff email alerts only. */
export function IntegrationCredentialsPanel({ canUpdate }: IntegrationCredentialsPanelProps) {
	const [draft, setDraft] = useState<IntegrationSettingsValues | null>(null);
	const [status, setStatus] = useState<{
		otp: OtpIntegrationStatus;
		storage: StorageIntegrationStatus;
		onlinePayment: OnlinePaymentIntegrationStatus;
	} | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const load = useCallback(async () => {
		const data = await apiFetch<{
			settings: IntegrationSettingsValues;
			status: { otp: OtpIntegrationStatus; storage: StorageIntegrationStatus; onlinePayment: OnlinePaymentIntegrationStatus };
		}>("/api/settings/integrations");
		setDraft(data.settings);
		setStatus(data.status);
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- initial integration settings fetch
		void load().catch(() => undefined);
	}, [load]);

	function setField<K extends keyof IntegrationSettingsValues>(field: K, value: IntegrationSettingsValues[K]) {
		setDraft((current) => (current ? { ...current, [field]: value } : current));
	}

	async function handleSave() {
		if (!draft || !canUpdate) {
			return;
		}
		setIsSaving(true);
		setMessage(null);
		try {
			const data = await apiFetch<{
				settings: IntegrationSettingsValues;
				status: { otp: OtpIntegrationStatus; storage: StorageIntegrationStatus; onlinePayment: OnlinePaymentIntegrationStatus };
			}>("/api/settings/integrations", {
				method: "PUT",
				body: JSON.stringify({
					smtpHost: draft.smtpHost,
					smtpPort: draft.smtpPort,
					smtpUser: draft.smtpUser,
					smtpPass: draft.smtpPass,
					smtpFrom: draft.smtpFrom,
					staffNotifyEmail: draft.staffNotifyEmail,
					adminSiteUrl: draft.adminSiteUrl,
					awsS3Bucket: draft.awsS3Bucket,
					awsS3Region: draft.awsS3Region,
					awsAccessKeyId: draft.awsAccessKeyId,
					awsSecretAccessKey: draft.awsSecretAccessKey,
					awsS3PublicUrlBase: draft.awsS3PublicUrlBase,
					awsS3Endpoint: draft.awsS3Endpoint,
				}),
			});
			setDraft(data.settings);
			setStatus(data.status);
			setMessage("Integration settings saved.");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Could not save integration settings.");
		} finally {
			setIsSaving(false);
		}
	}

	if (!draft) {
		return <p className="text-[13px] text-[var(--color-ink-500)]">Loading integration settings…</p>;
	}

	return (
		<div className="space-y-8">
			{message ? <p className="text-[13px] text-[var(--color-ink-700)]">{message}</p> : null}

			<FormSection
				title="Email & staff alerts"
				description="Configure outbound SMTP credentials (Gmail, Google Workspace, or custom SMTP server) for customer notifications and staff alerts."
			>
				<FormGrid cols={3}>
					<TextField
						label="SMTP Host"
						value={draft.smtpHost}
						onChange={(event) => setField("smtpHost", event.target.value)}
						placeholder="e.g. smtp.gmail.com"
						disabled={!canUpdate}
					/>
					<TextField
						label="SMTP Port"
						value={draft.smtpPort}
						onChange={(event) => setField("smtpPort", event.target.value)}
						placeholder="587"
						disabled={!canUpdate}
					/>
					<TextField
						label="SMTP From Email"
						value={draft.smtpFrom}
						onChange={(event) => setField("smtpFrom", event.target.value)}
						placeholder="no-reply@yourdomain.com"
						disabled={!canUpdate}
					/>
					<TextField
						label="SMTP Username / Email"
						value={draft.smtpUser}
						onChange={(event) => setField("smtpUser", event.target.value)}
						placeholder="user@domain.com"
						disabled={!canUpdate}
					/>
					<TextField
						label="SMTP Password / App Password"
						type="password"
						value={draft.smtpPass}
						onChange={(event) => setField("smtpPass", event.target.value)}
						placeholder="••••••••••••"
						disabled={!canUpdate}
					/>
					<TextField
						label="Staff notify email"
						value={draft.staffNotifyEmail}
						onChange={(event) => setField("staffNotifyEmail", event.target.value)}
						hint="Staff email target for order alerts."
						leadingIcon={<Mail size={14} />}
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			<FormSection
				title="Media storage (Cloudflare R2 / S3)"
				description="Manage Cloudflare R2 / S3 bucket credentials for image uploads and storage."
			>
				<FormGrid cols={3}>
					<TextField
						label="Bucket Name"
						value={draft.awsS3Bucket}
						onChange={(event) => setField("awsS3Bucket", event.target.value)}
						placeholder="my-store-bucket"
						disabled={!canUpdate}
					/>
					<TextField
						label="Region"
						value={draft.awsS3Region}
						onChange={(event) => setField("awsS3Region", event.target.value)}
						placeholder="auto"
						disabled={!canUpdate}
					/>
					<TextField
						label="Access Key ID"
						value={draft.awsAccessKeyId}
						onChange={(event) => setField("awsAccessKeyId", event.target.value)}
						placeholder="Access Key ID"
						disabled={!canUpdate}
					/>
					<TextField
						label="Secret Access Key"
						type="password"
						value={draft.awsSecretAccessKey}
						onChange={(event) => setField("awsSecretAccessKey", event.target.value)}
						placeholder="••••••••••••"
						disabled={!canUpdate}
					/>
					<TextField
						label="Public URL Base (CDN / r2.dev)"
						value={draft.awsS3PublicUrlBase}
						onChange={(event) => setField("awsS3PublicUrlBase", event.target.value)}
						placeholder="https://pub-xxxx.r2.dev"
						disabled={!canUpdate}
					/>
					<TextField
						label="S3 / R2 Endpoint"
						value={draft.awsS3Endpoint}
						onChange={(event) => setField("awsS3Endpoint", event.target.value)}
						placeholder="https://<account_id>.r2.cloudflarestorage.com"
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			{canUpdate ? (
				<div className="flex justify-end">
					<Button variant="primary" size="md" onClick={() => void handleSave()} isLoading={isSaving}>
						Save integration settings
					</Button>
				</div>
			) : null}
		</div>
	);
}
