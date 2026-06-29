"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@store/ui";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { SettingsFormPanel } from "@/app/settings/_components/settingsWorkspaceUi";
import { useToast } from "@/components/ui/Toast";
import { useAdminPermissions } from "@/lib/permissionsContext";

/**
 * "Data cleanup" tab inside admin Settings.
 *
 * Lets the operator bulk-delete every record of a single entity at once.
 * Designed for clearing out legacy / accidentally-created data — the kind
 * of one-off scrubbing that's painful to do from the per-row drawer.
 *
 * Safety: the server requires the operator to type a specific phrase
 * (e.g. "DELETE ALL ORDERS") in the request body. The UI mirrors that
 * exactly — the confirm button stays disabled until the typed text
 * matches, so this is impossible to trigger by misclick or stray Enter.
 *
 * Catalog cleanup is explicit because it deletes products, categories, brands,
 * grades, and attributes so admins can rebuild everything manually.
 */
interface CleanupTargetConfig {
	id: "catalog" | "orders" | "inquiries" | "customers";
	title: string;
	description: string;
	cascadeWarning?: string;
	confirmationPhrase: string;
}

const CLEANUP_TARGETS: ReadonlyArray<CleanupTargetConfig> = [
	{
		id: "catalog",
		title: "Delete all catalog",
		description: "Permanently removes every product, category, brand, grade, and attribute. Use this before rebuilding the catalog manually.",
		cascadeWarning: "Cascade — product pages, category pages, filters, grades, and attributes will be empty until admins add them again.",
		confirmationPhrase: "DELETE ALL CATALOG",
	},
	{
		id: "orders",
		title: "Delete all orders",
		description: "Permanently removes every order record. Stock and loyalty side-effects are reversed for orders that were 'confirmed' or 'delivered' before deletion.",
		confirmationPhrase: "DELETE ALL ORDERS",
	},
	{
		id: "inquiries",
		title: "Delete all inquiries",
		description: "Permanently removes every inquiry and the notes attached to them.",
		confirmationPhrase: "DELETE ALL INQUIRIES",
	},
	{
		id: "customers",
		title: "Delete all customers",
		description: "Permanently removes every customer profile.",
		cascadeWarning: "Cascade — all orders and loyalty accounts are also deleted to keep referential integrity. Run order cleanup first if you only want to scrub orders.",
		confirmationPhrase: "DELETE ALL CUSTOMERS",
	},
];

interface CleanupResponse {
	target: CleanupTargetConfig["id"];
	deletedCount: number;
}

export function SettingsCleanup() {
	const { can } = useAdminPermissions();

	if (!can("data_cleanup")) {
		return (
			<SettingsFormPanel>
				<p className="py-8 text-center text-sm text-[var(--color-ink-500)]">Bulk data cleanup is restricted to the store owner. Contact an owner if you need to clear test data.</p>
			</SettingsFormPanel>
		);
	}

	return (
		<SettingsFormPanel>
			<div className="space-y-5 py-2">
				<div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-4">
					<AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger-700)]" aria-hidden />
					<div className="space-y-1 text-sm">
						<p className="font-semibold text-[var(--color-danger-800)]">Destructive operations</p>
						<p className="text-[var(--color-danger-700)]">
							These actions permanently delete data. Store settings are never touched. Type the exact confirmation phrase into each card to enable the delete button.
						</p>
					</div>
				</div>

				{CLEANUP_TARGETS.map((target) => (
					<CleanupCard key={target.id} target={target} />
				))}
			</div>
		</SettingsFormPanel>
	);
}

interface CleanupCardProps {
	target: CleanupTargetConfig;
}

function CleanupCard({ target }: CleanupCardProps) {
	const router = useRouter();
	const toast = useToast();
	const [typed, setTyped] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);

	const isPhraseMatched = typed.trim() === target.confirmationPhrase;

	async function handleDelete() {
		if (!isPhraseMatched || isDeleting) {
			return;
		}
		setIsDeleting(true);
		try {
			const result = await apiFetch<CleanupResponse>("/api/cleanup", {
				method: "POST",
				json: {
					target: target.id,
					confirmation: target.confirmationPhrase,
				},
			});
			toast.success(`Deleted ${result.deletedCount} ${target.id} record${result.deletedCount === 1 ? "" : "s"}.`);
			setTyped("");
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Cleanup failed");
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<FormSection title={target.title} description={target.description}>
			{target.cascadeWarning ? (
				<p className="rounded-[var(--radius-sm)] border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-3 py-2 text-xs text-[var(--color-warn-800)]">
					{target.cascadeWarning}
				</p>
			) : null}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
				<div className="flex-1">
					<TextField
						label={`Type "${target.confirmationPhrase}" to enable`}
						value={typed}
						onChange={(event) => setTyped(event.target.value)}
						placeholder={target.confirmationPhrase}
						autoComplete="off"
						spellCheck={false}
					/>
				</div>
				<Button variant="danger" size="md" type="button" onClick={handleDelete} disabled={!isPhraseMatched} isLoading={isDeleting} leadingIcon={<Trash2 size={14} />}>
					Delete all
				</Button>
			</div>
		</FormSection>
	);
}
