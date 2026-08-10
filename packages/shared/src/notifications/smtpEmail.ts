import { logger } from "../logger";
import type { IntegrationSettingsValues } from "../integration/integrationSettingsSchema";

export interface SendOutboundEmailInput {
	to: string;
	subject: string;
	text: string;
	from?: string;
	settings?: Pick<
		IntegrationSettingsValues,
		"smtpHost" | "smtpPort" | "smtpUser" | "smtpPass" | "smtpFrom"
	>;
}

type SmtpConfig = {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
};

function parseSmtpPort(value: string | undefined): number {
	const port = Number(value?.trim() || "587");
	return Number.isFinite(port) && port > 0 ? port : 587;
}

function readSmtpConfig(
	settings?: Pick<IntegrationSettingsValues, "smtpHost" | "smtpPort" | "smtpUser" | "smtpPass" | "smtpFrom">,
): SmtpConfig | null {
	const host = settings?.smtpHost?.trim() || process.env.SMTP_HOST?.trim();
	const user = settings?.smtpUser?.trim() || process.env.SMTP_USER?.trim();
	const pass = settings?.smtpPass?.trim() || process.env.SMTP_PASS?.trim();
	if (!host || !user || !pass) {
		return null;
	}
	const from =
		settings?.smtpFrom?.trim() ||
		process.env.SMTP_FROM?.trim() ||
		user;
	return {
		host,
		port: parseSmtpPort(settings?.smtpPort || process.env.SMTP_PORT),
		user,
		pass,
		from,
	};
}

async function resolveSmtpConfig(
	settings?: SendOutboundEmailInput["settings"],
): Promise<SmtpConfig | null> {
	let resolved = readSmtpConfig(settings);
	if (resolved) {
		return resolved;
	}
	try {
		const { getIntegrationSettings } = await import("@store/db");
		const integration = await getIntegrationSettings();
		resolved = readSmtpConfig(integration);
	} catch (error) {
		logger.warn({ error }, "SMTP: could not load integration settings");
	}
	return resolved;
}

/** Send a plain-text email via SMTP (Gmail, Google Workspace, or any SMTP host). */
export async function sendOutboundEmail(input: SendOutboundEmailInput): Promise<boolean> {
	const to = input.to.trim();
	if (!to) {
		return false;
	}

	const smtp = await resolveSmtpConfig(input.settings);
	if (!smtp) {
		logger.warn("Outbound email skipped — SMTP is not configured");
		return false;
	}

	try {
		const nodemailer = await import("nodemailer");
		const transporter = nodemailer.createTransport({
			host: smtp.host,
			port: smtp.port,
			secure: smtp.port === 465,
			auth: { user: smtp.user, pass: smtp.pass },
		});

		await transporter.sendMail({
			from: input.from?.trim() || smtp.from,
			to,
			subject: input.subject,
			text: input.text,
		});
		return true;
	} catch (error) {
		logger.warn({ error }, "SMTP email request failed");
		return false;
	}
}

/** True when SMTP host + user + password are available (settings or env). */
export function isOutboundEmailConfigured(
	settings?: Pick<IntegrationSettingsValues, "smtpHost" | "smtpUser" | "smtpPass">,
): boolean {
	return readSmtpConfig(settings as IntegrationSettingsValues | undefined) !== null;
}
