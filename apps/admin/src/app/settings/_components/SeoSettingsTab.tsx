"use client";

import { useEffect, useMemo, useState } from "react";

import { applyTitleTemplate } from "@store/shared";

import { apiFetch } from "@/lib/api";
import { storedImageFromSetting } from "@/lib/seo/useSeoSettings";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { TextArea } from "@/components/forms/TextArea";
import { ImageUpload } from "@/components/shared/uploads/ImageUpload";
import { type GalleryImage, uploadGalleryImages } from "@/components/shared/uploads/imageStaging";
import { FormGrid, SettingsFormPanel, SettingsLoadingPanel, SettingsSaveFooter } from "@/app/settings/_components/settingsWorkspaceUi";
import { useToast } from "@/components/ui/Toast";
import { useStoreSettings } from "@/lib/storeSettingsContext";

interface AdminSettingRow {
	key: string;
	value: unknown;
}

interface SettingsListResponse {
	items: AdminSettingRow[];
}

interface SeoGlobalDraft {
	seoStoreName: string;
	titleTemplate: string;
	defaultDescription: string;
	ogImageDefault: GalleryImage | null;
	googleSiteVerification: string;
	robotsDisallow: string;
	organizationLegalName: string;
	organizationPhone: string;
	organizationEmail: string;
	organizationStreet: string;
	organizationCity: string;
	organizationRegion: string;
	organizationPostalCode: string;
	organizationCountry: string;
	organizationSameAs: string;
}

const DEFAULTS: SeoGlobalDraft = {
	seoStoreName: "",
	titleTemplate: "{title} | {storeName}",
	defaultDescription: "",
	ogImageDefault: null,
	googleSiteVerification: "",
	robotsDisallow: "/admin\n/account\n/checkout\n/cart",
	organizationLegalName: "",
	organizationPhone: "",
	organizationEmail: "",
	organizationStreet: "",
	organizationCity: "",
	organizationRegion: "",
	organizationPostalCode: "",
	organizationCountry: "PK",
	organizationSameAs: "",
};

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function parseAddress(value: unknown): {
	street: string;
	city: string;
	region: string;
	postalCode: string;
	country: string;
} {
	if (!value || typeof value !== "object") {
		return { street: "", city: "", region: "", postalCode: "", country: "PK" };
	}
	const v = value as Record<string, unknown>;
	return {
		street: asString(v.street),
		city: asString(v.city),
		region: asString(v.region),
		postalCode: asString(v.postalCode),
		country: asString(v.country, "PK"),
	};
}

function parseRobotsDisallow(value: unknown): string {
	if (Array.isArray(value)) {
		return value.filter((x): x is string => typeof x === "string").join("\n");
	}
	return DEFAULTS.robotsDisallow;
}

function parseSameAs(value: unknown): string {
	if (Array.isArray(value)) {
		return value.filter((x): x is string => typeof x === "string").join("\n");
	}
	return "";
}

export function SeoSettingsTab({ readOnly = false }: { readOnly?: boolean }) {
	const toast = useToast();
	const store = useStoreSettings();
	const [draft, setDraft] = useState<SeoGlobalDraft>(DEFAULTS);
	const [saved, setSaved] = useState<SeoGlobalDraft>(DEFAULTS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const [seoRes, brandingRes] = await Promise.all([
					apiFetch<SettingsListResponse>("/api/settings?group=seo"),
					apiFetch<SettingsListResponse>("/api/settings?group=branding"),
				]);
				if (cancelled) return;
				const map = new Map([...seoRes.items.map((row) => [row.key, row.value] as const), ...brandingRes.items.map((row) => [row.key, row.value] as const)]);
				const addr = parseAddress(map.get("seo.organization.address"));
				const state: SeoGlobalDraft = {
					seoStoreName: asString(map.get("seo.storeName")),
					titleTemplate: asString(map.get("seo.titleTemplate"), DEFAULTS.titleTemplate),
					defaultDescription: asString(map.get("seo.defaultDescription"), store.siteTagline),
					ogImageDefault: storedImageFromSetting(map.get("seo.ogImageDefault")),
					googleSiteVerification: asString(map.get("seo.googleSiteVerification")),
					robotsDisallow: parseRobotsDisallow(map.get("seo.robotsDisallow")),
					organizationLegalName: asString(map.get("seo.organization.legalName")),
					organizationPhone: asString(map.get("seo.organization.contactPhone")),
					organizationEmail: asString(map.get("seo.organization.contactEmail")),
					organizationStreet: addr.street,
					organizationCity: addr.city,
					organizationRegion: addr.region,
					organizationPostalCode: addr.postalCode,
					organizationCountry: addr.country,
					organizationSameAs: parseSameAs(map.get("seo.organization.sameAs")),
				};
				setDraft(state);
				setSaved(state);
			} catch (error) {
				toast.danger(error instanceof Error ? error.message : "Failed to load SEO settings");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [store.siteTagline, toast]);

	const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

	const titlePreview = useMemo(() => {
		const storeName = draft.seoStoreName.trim() || store.siteName;
		return applyTitleTemplate(draft.titleTemplate, {
			title: "Sample product title",
			storeName,
			brandName: "Royal",
			categoryLabel: "Fans",
		});
	}, [draft.seoStoreName, draft.titleTemplate, store.siteName]);

	function setField<K extends keyof SeoGlobalDraft>(field: K, value: SeoGlobalDraft[K]) {
		setDraft((current) => ({ ...current, [field]: value }));
	}

	async function persist(key: string, value: unknown, group: string) {
		await apiFetch("/api/settings", {
			method: "PUT",
			json: { key, value, group },
		});
	}

	async function handleSave() {
		if (saving) return;
		setSaving(true);
		try {
			const disallowPaths = draft.robotsDisallow
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => (line.startsWith("/") ? line : `/${line}`));
			const sameAs = draft.organizationSameAs
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean);
			const [storedOgImageDefault] = draft.ogImageDefault
				? await uploadGalleryImages([draft.ogImageDefault], {
						subjectKind: "seo",
						subjectId: "default-og",
					})
				: [];
			const savedDraft: SeoGlobalDraft = {
				...draft,
				ogImageDefault: storedOgImageDefault ?? null,
			};

			await Promise.all([
				persist("seo.storeName", draft.seoStoreName.trim(), "seo"),
				persist("seo.titleTemplate", draft.titleTemplate.trim(), "seo"),
				persist("seo.defaultDescription", draft.defaultDescription.trim(), "seo"),
				persist("seo.ogImageDefault", savedDraft.ogImageDefault, "seo"),
				persist("seo.googleSiteVerification", draft.googleSiteVerification.trim(), "seo"),
				persist("seo.robotsDisallow", disallowPaths, "seo"),
				persist("seo.organization.legalName", draft.organizationLegalName.trim(), "seo"),
				persist("seo.organization.contactPhone", draft.organizationPhone.trim(), "seo"),
				persist("seo.organization.contactEmail", draft.organizationEmail.trim(), "seo"),
				persist(
					"seo.organization.address",
					{
						street: draft.organizationStreet.trim(),
						city: draft.organizationCity.trim(),
						region: draft.organizationRegion.trim(),
						postalCode: draft.organizationPostalCode.trim(),
						country: draft.organizationCountry.trim() || "PK",
					},
					"seo",
				),
				persist("seo.organization.sameAs", sameAs, "seo"),
			]);
			setDraft(savedDraft);
			setSaved(savedDraft);
			toast.success("SEO settings saved");
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to save SEO settings");
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <SettingsLoadingPanel />;
	}

	return (
		<SettingsFormPanel
			footer={
				!readOnly ? (
					<SettingsSaveFooter
						onSave={() => void handleSave()}
						onDiscard={() => setDraft(saved)}
						showDiscard={isDirty}
						saveLabel={saving ? "Saving…" : isDirty ? "Save SEO settings" : "Saved"}
						hint={isDirty ? "You have unsaved SEO changes." : "Up to date — search and social previews update after save."}
					/>
				) : undefined
			}
		>
			<div className="space-y-0">
				<FormSection title="Global SEO" description="Defaults used when an entity has no per-page SEO overrides. Changes propagate to the storefront after save.">
					<FormGrid>
						<TextField
							label="SEO store name"
							value={draft.seoStoreName}
							onChange={(event) => setField("seoStoreName", event.target.value)}
							placeholder={store.siteName}
							hint="Blank uses the site name from Store details settings."
							disabled={readOnly}
						/>
						<TextField
							label="Title template"
							value={draft.titleTemplate}
							onChange={(event) => setField("titleTemplate", event.target.value)}
							placeholder="{title} | {storeName}"
							hint="Placeholders: {title}, {storeName}, {brandName}, {categoryLabel}"
							disabled={readOnly}
						/>
					</FormGrid>
					<p className="rounded-md bg-[var(--color-canvas-deep)] px-3 py-2 text-xs text-[var(--color-ink-700)]">
						Preview: <span className="font-medium">{titlePreview}</span>
					</p>
					<TextArea
						label="Default meta description"
						value={draft.defaultDescription}
						onChange={(event) => setField("defaultDescription", event.target.value)}
						rows={3}
						placeholder="One or two sentences shown in search results when a page doesn't define its own description."
						hint="Aim for 150–160 characters."
						disabled={readOnly}
					/>
					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">Default OG image</p>
						<ImageUpload value={draft.ogImageDefault} onChange={(image) => setField("ogImageDefault", image)} altTextBase="Site OG image" />
					</div>
					<TextField
						label="Google Search Console verification"
						value={draft.googleSiteVerification}
						onChange={(event) => setField("googleSiteVerification", event.target.value)}
						placeholder="google-site-verification token"
						disabled={readOnly}
					/>
					<TextArea
						label="Robots disallow paths (one per line)"
						value={draft.robotsDisallow}
						onChange={(event) => setField("robotsDisallow", event.target.value)}
						rows={4}
						placeholder="/admin&#10;/account&#10;/checkout&#10;/cart"
						hint="Each line becomes a Disallow rule in robots.txt."
						disabled={readOnly}
					/>
				</FormSection>

				<FormSection
					title="Organization (JSON-LD)"
					description="Structured data for the home page Organization block. These mirror your Contact and Social settings — set them here only to override the values used in search-engine structured data."
				>
					<FormGrid>
						<TextField
							label="Legal name"
							value={draft.organizationLegalName}
							onChange={(event) => setField("organizationLegalName", event.target.value)}
							placeholder="e.g. Chandni Traders (Pvt.) Ltd"
							disabled={readOnly}
						/>
						<TextField
							label="Country"
							value={draft.organizationCountry}
							onChange={(event) => setField("organizationCountry", event.target.value)}
							placeholder="PK"
							hint="Two-letter ISO country code (e.g. PK, AE, GB)."
							autoComplete="country"
							disabled={readOnly}
						/>
						<TextField
							label="Contact phone"
							value={draft.organizationPhone}
							onChange={(event) => setField("organizationPhone", event.target.value)}
							placeholder="+92 320 4862403"
							inputMode="tel"
							autoComplete="tel"
							disabled={readOnly}
						/>
						<TextField
							label="Contact email"
							type="email"
							value={draft.organizationEmail}
							onChange={(event) => setField("organizationEmail", event.target.value)}
							placeholder="support@yourstore.com"
							inputMode="email"
							autoComplete="email"
							disabled={readOnly}
						/>
						<TextField
							label="Street"
							value={draft.organizationStreet}
							onChange={(event) => setField("organizationStreet", event.target.value)}
							placeholder="Shop 12, Main Boulevard"
							autoComplete="address-line1"
							disabled={readOnly}
						/>
						<TextField
							label="City"
							value={draft.organizationCity}
							onChange={(event) => setField("organizationCity", event.target.value)}
							placeholder="City"
							autoComplete="address-level2"
							disabled={readOnly}
						/>
						<TextField
							label="Region"
							value={draft.organizationRegion}
							onChange={(event) => setField("organizationRegion", event.target.value)}
							placeholder="Punjab"
							autoComplete="address-level1"
							disabled={readOnly}
						/>
						<TextField
							label="Postal code"
							value={draft.organizationPostalCode}
							onChange={(event) => setField("organizationPostalCode", event.target.value)}
							placeholder="54000"
							autoComplete="postal-code"
							disabled={readOnly}
						/>
					</FormGrid>
					<TextArea
						label="Social profile URLs (sameAs, one per line)"
						value={draft.organizationSameAs}
						onChange={(event) => setField("organizationSameAs", event.target.value)}
						rows={3}
						placeholder="https://facebook.com/yourstore&#10;https://instagram.com/yourstore"
						hint="One URL per line — mirrors your Social links. Added to the Organization JSON-LD."
						disabled={readOnly}
					/>
				</FormSection>
			</div>
		</SettingsFormPanel>
	);
}
