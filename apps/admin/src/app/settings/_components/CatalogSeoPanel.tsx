"use client";

import { useDeferredValue, useMemo } from "react";

import type { SeoMeta } from "@store/shared";

import { resolveCatalogSeo, type CatalogSeoInput } from "@/lib/seo/resolveCatalogSeo";
import { useSeoSettings } from "@/lib/seo/useSeoSettings";
import { SeoChecklistView } from "@/app/settings/_components/SeoChecklistView";
import { SeoPanel } from "@/app/settings/_components/SeoPanel";
import { SerpPreview } from "@/app/settings/_components/SerpPreview";
import { SocialPreview } from "@/app/settings/_components/SocialPreview";

interface CatalogSeoPanelProps {
	value: SeoMeta;
	onChange: (next: SeoMeta) => void;
	entity: CatalogSeoInput;
	contextLabel?: string;
}

export function CatalogSeoPanel({ value, onChange, entity, contextLabel }: CatalogSeoPanelProps) {
	const { settings, loading } = useSeoSettings();
	const deferredEntity = useDeferredValue(entity);

	const preview = useMemo(() => {
		if (!settings) {
			return null;
		}
		return resolveCatalogSeo(deferredEntity, value, settings);
	}, [deferredEntity, value, settings]);

	const resolved = preview?.resolved;
	const checklist = preview?.checklist;

	const previewSlot =
		resolved && settings ? (
			<div className="space-y-4">
				{checklist ? <SeoChecklistView result={checklist} /> : null}
				<div className="grid gap-4 lg:grid-cols-2">
					<SerpPreview resolved={resolved} siteUrl={settings.siteUrl} />
					<SocialPreview resolved={resolved} siteUrl={settings.siteUrl} />
				</div>
			</div>
		) : loading ? (
			<p className="text-xs text-[var(--color-ink-500)]">Loading SEO preview…</p>
		) : null;

	return <SeoPanel value={value} onChange={onChange} contextLabel={contextLabel} previewSlot={previewSlot} checklist={checklist} />;
}
