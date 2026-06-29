import { resolveStorageProviderFromSettings, type StorageProvider } from "./providers";

/** Loads integration settings from DB, then resolves the active storage provider. */
export async function resolveStorageProvider(): Promise<StorageProvider> {
	const { getIntegrationSettings } = await import("@store/db");
	return resolveStorageProviderFromSettings(await getIntegrationSettings());
}
