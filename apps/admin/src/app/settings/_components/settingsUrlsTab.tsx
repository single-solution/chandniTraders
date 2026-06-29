"use client";

import { AlertTriangle, ExternalLink, Eye, Globe2, Link2 } from "lucide-react";
import { resolvePublicSiteUrl, STORE_SETTING_GROUPS } from "@store/shared";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { SettingsTabHero, type SettingsHeroMetric } from "@/app/settings/_components/settingsWorkspaceUi";
import { SaveableSection } from "@/app/settings/_components/settingsSaveableSection";
import type { SectionProps } from "@/app/settings/_components/settingsSectionProps";

interface SiteUrlsSettingsProps extends SectionProps {
	envFallbackStorefrontUrl: string;
}

export function SiteUrlsSettings({ draft, saved, setField, onSaved, canUpdate, envFallbackStorefrontUrl }: SiteUrlsSettingsProps) {
	const effectiveUrl = resolvePublicSiteUrl(draft.publicSiteUrl);
	const usesEnvFallback = draft.publicSiteUrl.trim().length === 0;
	const heroMetrics: SettingsHeroMetric[] = [
		{
			label: "Live storefront URL",
			value: effectiveUrl,
			tone: usesEnvFallback ? "warn" : "good",
			icon: Globe2,
			hint: usesEnvFallback ? `Using deploy env (${envFallbackStorefrontUrl}) until you save a URL here` : "Used for SEO, sitemap, product links, and admin “open storefront”",
		},
	];

	return (
		<SaveableSection
			fields={STORE_SETTING_GROUPS.urls}
			draft={draft}
			saved={saved}
			setField={setField}
			onSaved={onSaved}
			canUpdate={canUpdate}
			hero={
				<SettingsTabHero
					metrics={heroMetrics}
					actions={
						<a
							href={effectiveUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-accent-300)] hover:text-[var(--color-accent-800)]"
						>
							<Eye size={13} aria-hidden />
							Open storefront
							<ExternalLink size={11} className="opacity-60" aria-hidden />
						</a>
					}
				/>
			}
		>
			<FormSection
				title="Storefront URL"
				description="The public address customers use to browse your shop. Set this in production so SEO tags, sitemaps, and admin product links never fall back to localhost."
			>
				{usesEnvFallback ? (
					<div className="mb-3 flex gap-2 rounded-[var(--radius-md)] border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950">
						<AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
						<p>
							No URL saved yet — the site currently resolves to <strong className="font-semibold">{envFallbackStorefrontUrl}</strong> from deploy environment variables. Save your
							production domain here to override that everywhere.
						</p>
					</div>
				) : null}
				<TextField
					label="Public storefront URL"
					type="url"
					value={draft.publicSiteUrl}
					onChange={(event) => setField("publicSiteUrl", event.target.value)}
					placeholder="https://chandnitraders.pk"
					inputMode="url"
					autoComplete="url"
					hint="Include https:// — no trailing slash. Example: https://shop.example.com"
					disabled={!canUpdate}
				/>
				<div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2.5 text-[11.5px] text-[var(--color-ink-600)]">
					<Link2 size={13} className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" aria-hidden />
					<p>
						<strong className="font-semibold text-[var(--color-ink-800)]">Effective URL now:</strong> {effectiveUrl}
						{usesEnvFallback ? " (from env until saved)" : ""}
					</p>
				</div>
			</FormSection>
		</SaveableSection>
	);
}
