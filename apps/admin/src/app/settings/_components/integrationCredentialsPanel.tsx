"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Mail, MessageCircle } from "lucide-react";
import {
	type IntegrationSettingsValues,
	type OtpIntegrationStatus,
	type OnlinePaymentIntegrationStatus,
	type StorageIntegrationStatus,
} from "@store/shared";
import { apiFetch } from "@/lib/api";
import { FormSection } from "@/components/forms/FormSection";
import { SelectField } from "@/components/forms/SelectField";
import { Switch } from "@/components/forms/Switch";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@store/ui";
import { FormGrid } from "@/app/settings/_components/settingsWorkspaceUi";

interface IntegrationCredentialsPanelProps {
	canUpdate: boolean;
}

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
				body: JSON.stringify(draft),
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
				title="Online payments (Pakistan)"
				description={
					status?.onlinePayment.summary ??
					"Pick PayFast or Rapid Gateway. Bank transfer and COD stay available under Payments."
				}
			>
				<FormGrid cols={3}>
					<SelectField
						label="Active gateway"
						value={draft.onlinePaymentProvider}
						onChange={(event) =>
							setField("onlinePaymentProvider", event.target.value as IntegrationSettingsValues["onlinePaymentProvider"])
						}
						options={[
							{ value: "none", label: "None (bank transfer + COD only)" },
							{ value: "payfast", label: "PayFast" },
							{ value: "rapid-gateway", label: "Rapid Gateway" },
						]}
						disabled={!canUpdate}
					/>
				</FormGrid>

				{draft.onlinePaymentProvider === "payfast" ? (
					<div className="mt-4">
						<FormGrid cols={3}>
						<TextField
							label="Merchant ID"
							value={draft.payfastMerchantId}
							onChange={(event) => setField("payfastMerchantId", event.target.value)}
							disabled={!canUpdate}
						/>
						<TextField
							label="Secured key"
							type="password"
							value={draft.payfastSecuredKey}
							onChange={(event) => setField("payfastSecuredKey", event.target.value)}
							leadingIcon={<KeyRound size={14} />}
							disabled={!canUpdate}
						/>
						<TextField
							label="Merchant name"
							value={draft.payfastMerchantName}
							onChange={(event) => setField("payfastMerchantName", event.target.value)}
							disabled={!canUpdate}
						/>
						<Switch
							label="PayFast sandbox"
							description="Use PayFast UAT endpoints until you go live."
							checked={draft.payfastSandbox}
							onCheckedChange={(value) => setField("payfastSandbox", value)}
							disabled={!canUpdate}
						/>
						<p className="col-span-full text-[12px] text-[var(--color-ink-500)]">
							Webhooks: <code className="text-[11px]">/api/webhooks/payfast</code> · Return URL:{" "}
							<code className="text-[11px]">/api/payments/callback/payfast</code>
						</p>
					</FormGrid>
					</div>
				) : null}

				{draft.onlinePaymentProvider === "rapid-gateway" ? (
					<div className="mt-4">
						<FormGrid cols={3}>
						<TextField
							label="Secret key"
							type="password"
							value={draft.rapidGatewaySecretKey}
							onChange={(event) => setField("rapidGatewaySecretKey", event.target.value)}
							leadingIcon={<KeyRound size={14} />}
							disabled={!canUpdate}
						/>
						<TextField
							label="Webhook signing secret"
							type="password"
							value={draft.rapidGatewayWebhookSecret}
							onChange={(event) => setField("rapidGatewayWebhookSecret", event.target.value)}
							hint="Rapid Gateway dashboard → Webhooks → /api/webhooks/rapid-gateway"
							leadingIcon={<KeyRound size={14} />}
							disabled={!canUpdate}
						/>
						<Switch
							label="Rapid Gateway sandbox"
							description="Use sandbox API until you go live."
							checked={draft.rapidGatewaySandbox}
							onCheckedChange={(value) => setField("rapidGatewaySandbox", value)}
							disabled={!canUpdate}
						/>
					</FormGrid>
					</div>
				) : null}
			</FormSection>

			<FormSection title="Sign-in OTP (Meta WhatsApp)" description={status?.otp.summary ?? "WhatsApp verification codes for customer sign-in."}>
				<FormGrid cols={3}>
					<SelectField
						label="OTP provider"
						value={draft.otpProvider}
						onChange={(event) => setField("otpProvider", event.target.value as IntegrationSettingsValues["otpProvider"])}
						options={[
							{ value: "auto", label: "Auto (WhatsApp when configured)" },
							{ value: "whatsapp-cloud", label: "Meta WhatsApp Cloud" },
							{ value: "console", label: "Console (dev only)" },
						]}
						disabled={!canUpdate}
					/>
					<TextField
						label="Access token"
						type="password"
						value={draft.whatsappCloudAccessToken}
						onChange={(event) => setField("whatsappCloudAccessToken", event.target.value)}
						leadingIcon={<MessageCircle size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="Phone number ID"
						value={draft.whatsappPhoneNumberId}
						onChange={(event) => setField("whatsappPhoneNumberId", event.target.value)}
						disabled={!canUpdate}
					/>
					<TextField
						label="OTP template name"
						value={draft.whatsappOtpTemplateName}
						onChange={(event) => setField("whatsappOtpTemplateName", event.target.value)}
						placeholder="authentication"
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			<FormSection title="Email & staff alerts" description="Resend sends email to every active team member plus staff/support inboxes. WhatsApp goes to the staff number and any team member with a phone on their profile.">
				<FormGrid cols={3}>
					<TextField
						label="Resend API key"
						type="password"
						value={draft.resendApiKey}
						onChange={(event) => setField("resendApiKey", event.target.value)}
						leadingIcon={<Mail size={14} />}
						disabled={!canUpdate}
					/>
					<TextField
						label="From email"
						value={draft.resendFromEmail}
						onChange={(event) => setField("resendFromEmail", event.target.value)}
						placeholder="Store <notify@yourdomain.com>"
						disabled={!canUpdate}
					/>
					<TextField
						label="Staff notify email"
						value={draft.staffNotifyEmail}
						onChange={(event) => setField("staffNotifyEmail", event.target.value)}
						hint="Falls back to store support email when empty."
						disabled={!canUpdate}
					/>
					<TextField
						label="Admin site URL"
						type="url"
						value={draft.adminSiteUrl}
						onChange={(event) => setField("adminSiteUrl", event.target.value)}
						placeholder="https://admin.yourdomain.com"
						hint="Password reset links and inquiry deep links."
						disabled={!canUpdate}
					/>
					<TextField
						label="Staff WhatsApp number"
						value={draft.staffNotifyWhatsApp}
						onChange={(event) => setField("staffNotifyWhatsApp", event.target.value)}
						placeholder="923001234567"
						hint="Internal staff alerts only — not the customer chat number in Store contact."
						disabled={!canUpdate}
					/>
					<TextField
						label="Staff WhatsApp template"
						value={draft.whatsappStaffNotifyTemplate}
						onChange={(event) => setField("whatsappStaffNotifyTemplate", event.target.value)}
						hint="Meta utility template — single body parameter."
						disabled={!canUpdate}
					/>
					<TextField
						label="Customer order WhatsApp template"
						value={draft.whatsappCustomerOrderTemplate}
						onChange={(event) => setField("whatsappCustomerOrderTemplate", event.target.value)}
						hint="Order placed + status updates + agent chat replies."
						disabled={!canUpdate}
					/>
				</FormGrid>
			</FormSection>

			<FormSection title="Media storage" description={status?.storage.summary ?? "Product images and uploads."}>
				<FormGrid cols={3}>
					<SelectField
						label="Storage provider"
						value={draft.storageProvider}
						onChange={(event) => setField("storageProvider", event.target.value as IntegrationSettingsValues["storageProvider"])}
						options={[
							{ value: "vercel-blob", label: "Vercel Blob" },
							{ value: "s3", label: "Amazon S3" },
						]}
						disabled={!canUpdate}
					/>
					<TextField
						label="Blob read/write token"
						type="password"
						value={draft.blobReadWriteToken}
						onChange={(event) => setField("blobReadWriteToken", event.target.value)}
						disabled={!canUpdate || draft.storageProvider !== "vercel-blob"}
					/>
					<TextField
						label="S3 bucket"
						value={draft.awsS3Bucket}
						onChange={(event) => setField("awsS3Bucket", event.target.value)}
						disabled={!canUpdate || draft.storageProvider !== "s3"}
					/>
					<TextField
						label="S3 region"
						value={draft.awsS3Region}
						onChange={(event) => setField("awsS3Region", event.target.value)}
						disabled={!canUpdate || draft.storageProvider !== "s3"}
					/>
					<TextField
						label="AWS access key ID"
						value={draft.awsAccessKeyId}
						onChange={(event) => setField("awsAccessKeyId", event.target.value)}
						disabled={!canUpdate || draft.storageProvider !== "s3"}
					/>
					<TextField
						label="AWS secret access key"
						type="password"
						value={draft.awsSecretAccessKey}
						onChange={(event) => setField("awsSecretAccessKey", event.target.value)}
						disabled={!canUpdate || draft.storageProvider !== "s3"}
					/>
					<TextField
						label="S3 public URL base (optional)"
						value={draft.awsS3PublicUrlBase}
						onChange={(event) => setField("awsS3PublicUrlBase", event.target.value)}
						placeholder="https://cdn.yourdomain.com"
						disabled={!canUpdate || draft.storageProvider !== "s3"}
					/>
				</FormGrid>
			</FormSection>

			{canUpdate ? (
				<div className="flex justify-end">
					<Button variant="primary" size="md" onClick={() => void handleSave()} isLoading={isSaving}>
						Save integration credentials
					</Button>
				</div>
			) : null}
		</div>
	);
}
