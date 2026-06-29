import type { StoreSettings } from "@store/shared";

export interface SectionProps {
	draft: StoreSettings;
	saved: StoreSettings;
	setField<K extends keyof StoreSettings>(field: K, value: StoreSettings[K]): void;
	onSaved(settings: StoreSettings): void;
	canUpdate: boolean;
}
