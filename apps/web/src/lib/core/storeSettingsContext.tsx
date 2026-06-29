"use client";

import { createContext, useContext, type ReactNode } from "react";

import { STORE_SETTING_DEFAULTS, type StoreSettings } from "@store/shared";

/**
 * React Context that delivers the runtime `StoreSettings` (resolved server-side
 * via `getStoreSettings()` in the root layout) down to every client component
 * in the storefront. The default value is the factory defaults so a Storybook /
 * isolated render still works without explicit wiring.
 */
const StoreSettingsContext = createContext<StoreSettings>(STORE_SETTING_DEFAULTS);

interface StoreSettingsProviderProps {
	value: StoreSettings;
	children: ReactNode;
}

export function StoreSettingsProvider({ value, children }: StoreSettingsProviderProps) {
	return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings(): StoreSettings {
	return useContext(StoreSettingsContext);
}
