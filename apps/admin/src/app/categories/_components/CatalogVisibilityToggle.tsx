"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

/**
 * Inline Live/Hidden toggle for catalog entities (category, brand, grade,
 * attribute). PUTs `{ isActive }` to the entity's REST endpoint and refreshes
 * the server tree so dependent counts and cascade state stay in sync.
 */
export function CatalogVisibilityToggle({
	endpoint,
	label,
	isActive: initialActive,
	disabled = false,
}: {
	endpoint: string;
	label: string;
	isActive: boolean;
	disabled?: boolean;
}) {
	const router = useRouter();
	const toast = useToast();
	const [isActive, setIsActive] = useState(initialActive);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		scheduleStateUpdate(() => {
			setIsActive(initialActive);
		});
	}, [initialActive, endpoint]);

	async function handleToggle() {
		const next = !isActive;
		setSaving(true);
		try {
			await apiFetch(endpoint, { method: "PUT", json: { isActive: next } });
			setIsActive(next);
			toast.success(next ? `"${label}" is live on the storefront` : `"${label}" is hidden from the storefront`);
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to update visibility.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Toggle
			checked={isActive}
			onCheckedChange={() => void handleToggle()}
			isLoading={saving}
			disabled={disabled}
			aria-label={isActive ? `Hide ${label} from storefront` : `Make ${label} live on storefront`}
		/>
	);
}
