"use client";

import { useState } from "react";
import { FileText, Shield } from "lucide-react";
import { Button } from "@store/ui";
import { Modal } from "@/components/ui/Modal";
import { RichHtmlEditor } from "@/components/forms/RichHtmlEditor";
import type { StoreSettings } from "@store/shared";

type PolicyField = "returnPolicyHtml" | "privacyPolicyHtml";

interface PolicyDocumentEditorProps {
	draft: StoreSettings;
	setField<K extends keyof StoreSettings>(field: K, value: StoreSettings[K]): void;
	canUpdate: boolean;
}

const POLICY_CONFIG: Record<PolicyField, { title: string; label: string; icon: typeof FileText }> = {
	returnPolicyHtml: {
		title: "Return policy",
		label: "Return & moneyback policy",
		icon: FileText,
	},
	privacyPolicyHtml: {
		title: "Privacy policy",
		label: "Privacy policy",
		icon: Shield,
	},
};

export function PolicyDocumentEditors({ draft, setField, canUpdate }: PolicyDocumentEditorProps) {
	const [openField, setOpenField] = useState<PolicyField | null>(null);

	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2">
				{(Object.keys(POLICY_CONFIG) as PolicyField[]).map((field) => {
					const config = POLICY_CONFIG[field];
					const Icon = config.icon;
					const hasContent = draft[field].trim().length > 0;
					return (
						<div key={field} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] p-4">
							<div className="flex items-start gap-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)]">
									<Icon size={16} />
								</span>
								<div className="min-w-0">
									<p className="text-[13px] font-semibold text-[var(--color-ink-900)]">{config.label}</p>
									<p className="mt-0.5 text-[12px] text-[var(--color-ink-500)]">
										{hasContent ? "Published — customers see this in checkout modals." : "Empty — storefront falls back to a short notice."}
									</p>
								</div>
							</div>
							<Button type="button" variant="secondary" size="sm" onClick={() => setOpenField(field)} disabled={!canUpdate}>
								Edit in modal
							</Button>
						</div>
					);
				})}
			</div>

			{openField ? (
				<Modal
					isOpen
					onClose={() => setOpenField(null)}
					title={POLICY_CONFIG[openField].title}
					maxWidth="3xl"
					footer={
						<div className="flex justify-end">
							<Button type="button" variant="primary" size="sm" onClick={() => setOpenField(null)}>
								Done
							</Button>
						</div>
					}
				>
					<p className="mb-3 text-[12.5px] text-[var(--color-ink-500)]">
						Customers open this from checkout — no separate page. Save the Policies tab when you are finished editing.
					</p>
					<RichHtmlEditor
						value={draft[openField]}
						onChange={(html) => setField(openField, html)}
						disabled={!canUpdate}
						placeholder="Write your policy here…"
					/>
				</Modal>
			) : null}
		</>
	);
}
