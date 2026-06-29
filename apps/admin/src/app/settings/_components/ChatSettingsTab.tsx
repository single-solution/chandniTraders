"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { FormSection } from "@/components/forms/FormSection";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { TextArea } from "@/components/forms/TextArea";
import { Switch } from "@/components/forms/Switch";
import { SettingsFormPanel, SettingsLoadingPanel, SettingsSaveFooter, SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { useToast } from "@/components/ui/Toast";
import {
	ASSISTANT_CORE_RULES,
	ASSISTANT_TOOL_ROUTING,
	PAKISTAN_SALES_PSYCHOLOGY,
	STORE_HOW_IT_WORKS,
	CHAT_ASSISTANT_DEFAULT_MODELS,
	CHAT_ASSISTANT_DEFAULT_NAME,
	CHAT_ASSISTANT_PROVIDER_LABELS,
	CHAT_SETTING_DEFAULTS,
	CHAT_WELCOME_CUSTOMER_DEFAULT,
	CHAT_WELCOME_GUEST_DEFAULT,
	classNames,
	DEFAULT_ASSISTANT_INSTRUCTIONS,
	type ChatAssistantProvider,
	type ChatSettingsValues,
} from "@store/shared";

interface ProviderStatus {
	configured: boolean;
	model: string;
	defaultModel: string;
	dbModel: string;
}

interface ChatSettingsResponse {
	settings: ChatSettingsValues;
	providers: Record<ChatAssistantProvider, ProviderStatus>;
}

export function ChatSettingsTab({ readOnly = false }: { readOnly?: boolean }) {
	const toast = useToast();
	const [draft, setDraft] = useState<ChatSettingsValues>(CHAT_SETTING_DEFAULTS);
	const [saved, setSaved] = useState<ChatSettingsValues>(CHAT_SETTING_DEFAULTS);
	const [providers, setProviders] = useState<ChatSettingsResponse["providers"] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const data = await apiFetch<ChatSettingsResponse>("/api/settings/chat");
				if (cancelled) return;
				setDraft(data.settings);
				setSaved(data.settings);
				setProviders(data.providers);
			} catch (error) {
				toast.danger(error instanceof Error ? error.message : "Failed to load chat settings");
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [toast]);

	const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

	function setField<K extends keyof ChatSettingsValues>(field: K, value: ChatSettingsValues[K]) {
		setDraft((current) => ({ ...current, [field]: value }));
	}

	async function handleSave() {
		if (isSaving || !isDirty) return;
		setIsSaving(true);
		try {
			const data = await apiFetch<ChatSettingsResponse>("/api/settings/chat", {
				method: "PUT",
				json: draft,
			});
			setDraft(data.settings);
			setSaved(data.settings);
			setProviders(data.providers);
			toast.success("Chat settings saved");
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to save chat settings");
		} finally {
			setIsSaving(false);
		}
	}

	if (isLoading) {
		return <SettingsLoadingPanel />;
	}

	const isEditable = !readOnly;
	const providerMetrics: SettingsHeroMetric[] = providers
		? (["openai", "google", "anthropic"] as const).map((providerId) => ({
				label: CHAT_ASSISTANT_PROVIDER_LABELS[providerId],
				value: providers[providerId].configured ? "Ready" : "Key missing",
				tone: providers[providerId].configured ? "good" : "warn",
				icon: Bot,
			}))
		: [];

	return (
		<SettingsFormPanel
			footer={
				isEditable ? (
					<SettingsSaveFooter
						onSave={handleSave}
						onDiscard={() => setDraft(saved)}
						showDiscard={isDirty}
						saveLabel={isSaving ? "Saving…" : isDirty ? "Save chat settings" : "Saved"}
						hint={isDirty ? "You have unsaved chat widget changes." : "Up to date."}
					/>
				) : undefined
			}
		>
			<div className="border-b border-[var(--color-ink-100)] px-4 py-4 md:px-6">
				<SettingsTabHero
					description="Widget visibility, AI assistant, and provider API keys. Keys saved here override environment fallbacks for the active provider."
					metrics={providerMetrics}
				/>
			</div>
			<div className="py-6">
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start px-4 md:px-6">
					<Switch label="Enable Widget" description="Show floating chat button." checked={draft.enabled} onCheckedChange={(value) => setField("enabled", value)} disabled={!isEditable} />
					<Switch
						label="Idle Nudge"
						description="Teaser bubble when a visitor lingers."
						checked={draft.proactiveNudgeEnabled}
						onCheckedChange={(value) => setField("proactiveNudgeEnabled", value)}
						disabled={!isEditable || !draft.enabled}
					/>
					<NumberField
						label="Nudge After"
						value={draft.proactiveNudgeMinutes}
						onChange={(value) => setField("proactiveNudgeMinutes", value)}
						suffix="min"
						min={1}
						max={60}
						disabled={!isEditable || !draft.enabled || !draft.proactiveNudgeEnabled}
						hint="Idle minutes before the nudge."
					/>
					<NumberField
						label="Free Msg Limit"
						value={draft.guestMessageLimit}
						onChange={(value) => setField("guestMessageLimit", value)}
						min={1}
						max={100}
						disabled={!isEditable || !draft.enabled}
						hint="Max messages before sign-in."
					/>
					<NumberField
						label="Cookie Lifetime"
						value={draft.guestThreadTokenDays}
						onChange={(value) => setField("guestThreadTokenDays", value)}
						suffix="days"
						min={1}
						max={365}
						disabled={!isEditable || !draft.enabled}
						hint="Keep anonymous threads."
					/>

					<Switch
						label="Enable AI Replies"
						description="Instantly respond to messages."
						checked={draft.assistantEnabled}
						onCheckedChange={(value) => setField("assistantEnabled", value)}
						disabled={!isEditable || !draft.enabled}
					/>
					<SelectField
						label="Live Provider"
						value={draft.assistantProvider}
						onChange={(event) => setField("assistantProvider", event.target.value === "google" ? "google" : event.target.value === "anthropic" ? "anthropic" : "openai")}
						disabled={!isEditable || !draft.enabled || !draft.assistantEnabled}
						options={[
							{ value: "openai", label: CHAT_ASSISTANT_PROVIDER_LABELS.openai },
							{ value: "google", label: CHAT_ASSISTANT_PROVIDER_LABELS.google },
							{ value: "anthropic", label: CHAT_ASSISTANT_PROVIDER_LABELS.anthropic },
						]}
					/>
					<NumberField
						label="Temperature"
						value={draft.assistantTemperature}
						onChange={(value) => setField("assistantTemperature", value)}
						min={0}
						max={1}
						step={0.05}
						disabled={!isEditable || !draft.enabled || !draft.assistantEnabled}
						hint="0 to 1. Higher is more creative."
					/>
					<NumberField
						label="Max Tokens"
						value={draft.assistantMaxTokens}
						onChange={(value) => setField("assistantMaxTokens", value)}
						min={100}
						max={2000}
						disabled={!isEditable || !draft.enabled || !draft.assistantEnabled}
						hint="Max length of response."
					/>

					<div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
						<TextField
							label="Bot Display Name"
							value={draft.assistantName}
							onChange={(event) => setField("assistantName", event.target.value)}
							placeholder={CHAT_ASSISTANT_DEFAULT_NAME}
							disabled={!isEditable || !draft.enabled || !draft.assistantEnabled}
						/>
					</div>

					{draft.assistantEnabled && draft.enabled ? (
						<div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 space-y-4">
							<FormSection title="Provider API keys" description="Optional database overrides. Leave blank to use server environment variables. Only the active provider is called at runtime.">
								<div className="grid gap-4 lg:grid-cols-3">
									{(["openai", "google", "anthropic"] as const).map((providerId) => (
										<ProviderKeyFields
											key={providerId}
											providerId={providerId}
											label={CHAT_ASSISTANT_PROVIDER_LABELS[providerId]}
											isActive={draft.assistantProvider === providerId}
											configured={providers?.[providerId].configured ?? false}
											apiKey={
												providerId === "openai"
													? draft.providerApiKeyOpenai
													: providerId === "anthropic"
														? draft.providerApiKeyAnthropic
														: draft.providerApiKeyGoogle
											}
											model={
												providerId === "openai"
													? draft.assistantModelOpenai
													: providerId === "anthropic"
														? draft.assistantModelAnthropic
														: draft.assistantModelGoogle
											}
											onApiKeyChange={(value) =>
												setField(
													providerId === "openai" ? "providerApiKeyOpenai" : providerId === "anthropic" ? "providerApiKeyAnthropic" : "providerApiKeyGoogle",
													value,
												)
											}
											onModelChange={(value) =>
												setField(
													providerId === "openai" ? "assistantModelOpenai" : providerId === "anthropic" ? "assistantModelAnthropic" : "assistantModelGoogle",
													value,
												)
											}
											disabled={!isEditable}
										/>
									))}
								</div>
							</FormSection>
						</div>
					) : null}

					<div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
						<TextArea
							label="Guest Welcome Message"
							rows={3}
							value={draft.welcomeMessageGuest}
							onChange={(event) => setField("welcomeMessageGuest", event.target.value)}
							disabled={!isEditable || !draft.enabled}
							placeholder={CHAT_WELCOME_GUEST_DEFAULT}
							hint="Use {limit} to show message limit."
						/>
					</div>
					<div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
						<TextArea
							label="Customer Welcome Message"
							rows={3}
							value={draft.welcomeMessageCustomer}
							onChange={(event) => setField("welcomeMessageCustomer", event.target.value)}
							disabled={!isEditable || !draft.enabled}
							placeholder={CHAT_WELCOME_CUSTOMER_DEFAULT}
						/>
					</div>

					<div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
						<FormSection
							title="Polling intervals"
							description="How often open chat threads refresh. WebSocket live mode is not active yet — the storefront uses HTTP polling only."
						>
							<div className="grid gap-4 sm:grid-cols-2">
								<NumberField
									label="Poll (focused)"
									value={draft.pollIntervalMsFocused}
									onChange={(value) => setField("pollIntervalMsFocused", value)}
									suffix="ms"
									min={1000}
									max={60000}
									step={500}
									disabled={!isEditable || !draft.enabled}
									hint="Tab visible."
								/>
								<NumberField
									label="Poll (background)"
									value={draft.pollIntervalMsBlurred}
									onChange={(value) => setField("pollIntervalMsBlurred", value)}
									suffix="ms"
									min={5000}
									max={300000}
									step={1000}
									disabled={!isEditable || !draft.enabled}
									hint="Tab in background."
								/>
							</div>
						</FormSection>
					</div>

					<div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
						<div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)] p-3">
							<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Always enforced (built-in — cannot be edited)</p>
							<ul className="mt-2 space-y-1.5">
								{ASSISTANT_CORE_RULES.map((rule) => (
									<li key={rule} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-ink-600)]">
										<span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent-500)]" />
										<span>{rule}</span>
									</li>
								))}
							</ul>
							<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Store knowledge the bot always has (built-in)</p>
							<ul className="mt-2 space-y-1.5">
								{STORE_HOW_IT_WORKS.map((fact) => (
									<li key={fact} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-ink-600)]">
										<span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-ink-300)]" />
										<span>{fact}</span>
									</li>
								))}
							</ul>
							<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Sales psychology (built-in — honest dealer voice)</p>
							<ul className="mt-2 space-y-1.5">
								{PAKISTAN_SALES_PSYCHOLOGY.map((line) => (
									<li key={line} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-ink-600)]">
										<span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-warn-400)]" />
										<span>{line}</span>
									</li>
								))}
							</ul>
							<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Lookup routing (built-in)</p>
							<ul className="mt-2 space-y-1.5">
								{ASSISTANT_TOOL_ROUTING.map((step) => (
									<li key={step} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--color-ink-600)]">
										<span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent-300)]" />
										<span>{step}</span>
									</li>
								))}
							</ul>
						</div>
						<TextArea
							label="Assistant instructions"
							rows={18}
							value={draft.assistantInstructions || DEFAULT_ASSISTANT_INSTRUCTIONS}
							onChange={(event) => setField("assistantInstructions", event.target.value)}
							disabled={!isEditable || !draft.enabled || !draft.assistantEnabled}
							hint="How the bot talks and sells. Edit freely or add store-specific notes (promos, which models to push). The built-in rules above always apply. Leave matching the default to keep the standard playbook."
						/>
						{isEditable && draft.assistantInstructions.trim() && draft.assistantInstructions !== DEFAULT_ASSISTANT_INSTRUCTIONS ? (
							<button
								type="button"
								onClick={() => setField("assistantInstructions", "")}
								className="mt-1.5 text-[11px] font-semibold text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
							>
								Reset to default playbook
							</button>
						) : null}
					</div>
				</div>
			</div>
		</SettingsFormPanel>
	);
}

interface ProviderKeyFieldsProps {
	providerId: ChatAssistantProvider;
	label: string;
	isActive: boolean;
	configured: boolean;
	apiKey: string;
	model: string;
	onApiKeyChange: (value: string) => void;
	onModelChange: (value: string) => void;
	disabled?: boolean;
}

function ProviderKeyFields({ providerId, label, isActive, configured, apiKey, model, onApiKeyChange, onModelChange, disabled }: ProviderKeyFieldsProps) {
	return (
		<div
			className={classNames(
				"rounded-[var(--radius-md)] border p-3",
				isActive ? "border-[var(--color-accent-300)] bg-[var(--color-accent-50)]/40" : "border-[var(--color-ink-200)] bg-[var(--color-surface)]",
			)}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="text-[12px] font-semibold text-[var(--color-ink-900)]">{label}</p>
				<span
					className={classNames(
						"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
						configured ? "bg-[var(--color-success-100)] text-[var(--color-success-800)]" : "bg-[var(--color-ink-100)] text-[var(--color-ink-600)]",
					)}
				>
					{configured ? "Ready" : "No key"}
				</span>
			</div>
			{isActive ? <p className="mb-2 text-[10.5px] font-medium text-[var(--color-accent-800)]">Active provider</p> : null}
			<div className="space-y-3">
				<TextField
					label="API key"
					type="password"
					value={apiKey}
					onChange={(event) => onApiKeyChange(event.target.value)}
					placeholder={configured && !apiKey ? "•••••••• (env fallback)" : "sk-… or AIza…"}
					disabled={disabled}
				/>
				<TextField
					label="Model ID"
					value={model}
					onChange={(event) => onModelChange(event.target.value)}
					placeholder={CHAT_ASSISTANT_DEFAULT_MODELS[providerId]}
					hint="Blank = default."
					disabled={disabled}
				/>
			</div>
		</div>
	);
}

interface NumberFieldProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	suffix?: string;
	min?: number;
	max?: number;
	step?: number;
	hint?: string;
	disabled?: boolean;
}

function NumberField({ label, value, onChange, suffix, min, max, step, hint, disabled = false }: NumberFieldProps) {
	return (
		<label className={classNames("flex flex-col gap-1.5", disabled && "opacity-60")}>
			<span className="block text-sm font-semibold text-[var(--color-ink-900)]">{label}</span>
			<div className="flex items-center gap-2">
				<input
					type="number"
					value={value}
					min={min}
					max={max}
					step={step}
					disabled={disabled}
					onChange={(event) => {
						const next = Number(event.target.value);
						if (Number.isFinite(next)) onChange(next);
					}}
					className="h-8 flex-1 min-w-0 rounded border border-[var(--color-ink-200)] px-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-accent-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-500)]"
				/>
				{suffix && <span className="text-xs text-[var(--color-ink-500)]">{suffix}</span>}
			</div>
			{hint && <p className="text-[11px] text-[var(--color-ink-500)]">{hint}</p>}
		</label>
	);
}
