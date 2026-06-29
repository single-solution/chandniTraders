"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import type { StoreSettings } from "@store/shared";
import { SettingsCleanup } from "@/app/settings/_components/SettingsCleanup";
import { ChatSettingsTab } from "@/app/settings/_components/ChatSettingsTab";
import { SeoSettingsTab } from "@/app/settings/_components/SeoSettingsTab";
import { ContactSettings } from "@/app/settings/_components/settingsContactTab";
import { DeliverySettings } from "@/app/settings/_components/settingsDeliveryTab";
import { NoticesSettings } from "@/app/settings/_components/settingsNoticesTab";
import { IntegrationsSettings } from "@/app/settings/_components/settingsIntegrationsTab";
import { InventorySettings } from "@/app/settings/_components/settingsInventoryTab";
import { LoyaltySettings } from "@/app/settings/_components/settingsLoyaltyTab";
import { PaymentSettings } from "@/app/settings/_components/settingsPaymentsTab";
import { PolicySettings } from "@/app/settings/_components/settingsPoliciesTab";
import { StoreDetailsSettings } from "@/app/settings/_components/settingsStoreTab";
import { SiteUrlsSettings } from "@/app/settings/_components/settingsUrlsTab";
import {
	getSettingsTabMeta,
	isSettingsTabId,
	SETTINGS_NAV_GROUPS,
	SettingsMobileTabChip,
	SettingsNavItem,
	SettingsPanelHeader,
	type SettingsTabId,
} from "@/app/settings/_components/settingsWorkspaceUi";
import { useAdminPermissions } from "@/lib/permissionsContext";
import { classNames } from "@store/shared";
import { WorkspaceFrame, WorkspaceListHeader, WorkspaceReadOnlyBanner } from "@/components/shared/workspaceUi";

interface SettingsProps {
	initialSettings: StoreSettings;
	envFallbackStorefrontUrl: string;
}

export function Settings({ initialSettings, envFallbackStorefrontUrl }: SettingsProps) {
	return (
		<Suspense fallback={null}>
			<SettingsInner initialSettings={initialSettings} envFallbackStorefrontUrl={envFallbackStorefrontUrl} />
		</Suspense>
	);
}

function SettingsInner({ initialSettings, envFallbackStorefrontUrl }: SettingsProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { startNavigation } = useNavigationTransition();
	const { can } = useAdminPermissions();
	const canUpdate = can("settings_update");
	const canCleanup = can("data_cleanup");

	const [savedSettings, setSavedSettings] = useState<StoreSettings>(initialSettings);
	const [draft, setDraft] = useState<StoreSettings>(initialSettings);
	const [activeTab, setActiveTab] = useState<SettingsTabId>("store");

	const navGroups = useMemo(
		() =>
			SETTINGS_NAV_GROUPS.map((group) => ({
				...group,
				tabs: group.tabs.filter((tab) => tab.id !== "cleanup" || canCleanup),
			})).filter((group) => group.tabs.length > 0),
		[canCleanup],
	);

	const flatTabs = useMemo(() => navGroups.flatMap((group) => group.tabs), [navGroups]);

	const activeMeta = getSettingsTabMeta(activeTab);

	function setField<K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) {
		setDraft((current) => ({ ...current, [field]: value }));
	}

	useEffect(() => {
		scheduleStateUpdate(() => {
			const fromUrl = searchParams.get("tab");
			if (isSettingsTabId(fromUrl)) {
				if (fromUrl === "cleanup" && !canCleanup) {
					setActiveTab("store");
					return;
				}
				setActiveTab(fromUrl);
				return;
			}
			if (!flatTabs.some((tab) => tab.id === activeTab)) {
				setActiveTab(flatTabs[0]?.id ?? "store");
			}
		});
	}, [activeTab, canCleanup, flatTabs, searchParams]);

	function setTabUrl(tab: SettingsTabId) {
		setActiveTab(tab);
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", tab);
		const url = `/settings?${params.toString()}`;
		startNavigation(() => router.replace(url, { scroll: false }));
	}

	const tabContent: Record<SettingsTabId, ReactNode> = {
		urls: (
			<SiteUrlsSettings
				draft={draft}
				saved={savedSettings}
				setField={setField}
				onSaved={setSavedSettings}
				canUpdate={canUpdate}
				envFallbackStorefrontUrl={envFallbackStorefrontUrl}
			/>
		),
		store: <StoreDetailsSettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		contact: <ContactSettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		payments: <PaymentSettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		delivery: <DeliverySettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		notices: <NoticesSettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		inventory: <InventorySettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		integrations: <IntegrationsSettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		policies: <PolicySettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		loyalty: <LoyaltySettings draft={draft} saved={savedSettings} setField={setField} onSaved={setSavedSettings} canUpdate={canUpdate} />,
		seo: <SeoSettingsTab readOnly={!canUpdate} />,
		chat: <ChatSettingsTab readOnly={!canUpdate} />,
		cleanup: <SettingsCleanup />,
	};

	return (
		<WorkspaceFrame minHeight={false}>
			<WorkspaceListHeader iconElement={<SettingsIcon size={15} />} title="Settings" subtitle="Storefront, commerce rules, SEO, chat widget, and optional data cleanup." />
			{!canUpdate ? <WorkspaceReadOnlyBanner message="Read-only — you can view settings but not save changes." /> : null}

			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="hidden shrink-0 flex-col border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-2.5 lg:flex lg:w-44 lg:border-b-0 lg:border-r xl:w-52">
					<nav aria-label="Settings sections" className="-mx-1 flex-1 overflow-y-auto">
						{navGroups.map((group) => (
							<div key={group.id} className="mb-3 last:mb-0">
								<p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{group.label}</p>
								<ul className="flex flex-col gap-0.5">
									{group.tabs.map((tab) => (
										<SettingsNavItem key={tab.id} label={tab.label} isActive={activeTab === tab.id} onClick={() => setTabUrl(tab.id)} />
									))}
								</ul>
							</div>
						))}
					</nav>
				</aside>

				<section className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="shrink-0 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-3 py-2 lg:hidden">
						<div className="flex gap-1.5 overflow-x-auto pb-0.5">
							{flatTabs.map((tab) => (
								<SettingsMobileTabChip key={tab.id} label={tab.label} isActive={activeTab === tab.id} onClick={() => setTabUrl(tab.id)} />
							))}
						</div>
					</div>

					<div className={classNames("min-h-0 flex-1 overflow-y-auto", activeTab === "chat" && "bg-[var(--color-canvas-deep)]")}>
						<SettingsPanelHeader title={activeMeta.label} description={activeMeta.description} />
						{tabContent[activeTab]}
					</div>
				</section>
			</div>
		</WorkspaceFrame>
	);
}
