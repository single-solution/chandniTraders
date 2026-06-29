"use client";

import { useState, type FormEvent } from "react";
import { Check, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@store/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField } from "@/components/forms/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api";
import { FIELD_LIMITS, MAX_CUSTOMER_ADDRESSES } from "@store/shared";
import type { AdminCustomer, AdminCustomerAddress } from "@/types/models";
import { CustomerErrorBanner } from "./customerDetailUi";

export interface AddressDraft {
	label?: string;
	recipientName: string;
	phoneNumber: string;
	street?: string;
	area?: string;
	city: string;
	postalCode?: string;
	isDefault: boolean;
}

function toDraft(address: AdminCustomerAddress): AddressDraft {
	return {
		label: address.label,
		recipientName: address.recipientName,
		phoneNumber: address.phoneNumber,
		street: address.street ?? "",
		area: address.area ?? "",
		city: address.city,
		postalCode: address.postalCode ?? "",
		isDefault: address.isDefault,
	};
}

function draftsFromCustomer(customer: AdminCustomer): AddressDraft[] {
	return customer.addresses.map(toDraft);
}

interface CustomerAddressesSectionProps {
	customer: AdminCustomer;
	canManage: boolean;
	onUpdated: (customer: AdminCustomer) => void;
}

export function CustomerAddressesSection({ customer, canManage, onUpdated }: CustomerAddressesSectionProps) {
	const toast = useToast();
	const [addresses, setAddresses] = useState<AddressDraft[]>(() => draftsFromCustomer(customer));
	const [editingIndex, setEditingIndex] = useState<number | "new" | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [removeIndex, setRemoveIndex] = useState<number | null>(null);

	async function persist(next: AddressDraft[]) {
		setIsSaving(true);
		setError(null);
		try {
			const updated = await apiFetch<AdminCustomer>(`/api/customers/${customer.id}/addresses`, {
				method: "PUT",
				json: { addresses: next },
			});
			setAddresses(draftsFromCustomer(updated));
			onUpdated(updated);
			toast.success("Addresses saved");
			return true;
		} catch (err) {
			const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save addresses";
			setError(message);
			return false;
		} finally {
			setIsSaving(false);
		}
	}

	function handleAdd() {
		if (addresses.length >= MAX_CUSTOMER_ADDRESSES) {
			setError(`Maximum ${MAX_CUSTOMER_ADDRESSES} addresses per customer.`);
			return;
		}
		setEditingIndex("new");
		setError(null);
	}

	async function handleRemove(index: number) {
		const next = addresses.filter((_, i) => i !== index);
		if (addresses[index]?.isDefault && next.length > 0) {
			next[0] = { ...next[0], isDefault: true };
		}
		setAddresses(next);
		setRemoveIndex(null);
		setEditingIndex(null);
		await persist(next);
	}

	async function handleMakeDefault(index: number) {
		const next = addresses.map((address, i) => ({
			...address,
			isDefault: i === index,
		}));
		setAddresses(next);
		await persist(next);
	}

	async function handleSaveDraft(draft: AddressDraft) {
		let next: AddressDraft[];
		if (editingIndex === "new") {
			next = [...addresses, draft];
		} else if (typeof editingIndex === "number") {
			next = addresses.map((address, i) => (i === editingIndex ? draft : address));
		} else {
			return;
		}
		if (draft.isDefault) {
			const targetIndex = editingIndex === "new" ? next.length - 1 : editingIndex;
			next = next.map((address, i) => ({
				...address,
				isDefault: i === targetIndex,
			}));
		} else if (!next.some((address) => address.isDefault) && next.length > 0) {
			next[0] = { ...next[0], isDefault: true };
		}
		setAddresses(next);
		setEditingIndex(null);
		const saved = await persist(next);
		if (!saved) {
			setAddresses(draftsFromCustomer(customer));
		}
	}

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Saved addresses</p>
					<p className="mt-0.5 text-[10px] text-[var(--color-ink-500)]">
						{addresses.length} of {MAX_CUSTOMER_ADDRESSES} · customers usually add these on the website; edit here only to fix mistakes
					</p>
				</div>
				{canManage ? (
					<Button variant="secondary" size="sm" leadingIcon={<Plus size={13} />} onClick={handleAdd} disabled={isSaving || addresses.length >= MAX_CUSTOMER_ADDRESSES}>
						Add
					</Button>
				) : null}
			</div>

			{error ? <CustomerErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

			{addresses.length === 0 && editingIndex !== "new" ? (
				<p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-ink-200)] px-4 py-6 text-center text-xs text-[var(--color-ink-500)]">
					No saved addresses yet. {canManage ? "They can add delivery addresses from their account or at checkout." : ""}
				</p>
			) : null}

			<ul className="space-y-2">
				{addresses.map((address, index) => (
					<li key={`${address.recipientName}-${index}`}>
						{editingIndex === index ? (
							<AddressEditor
								draft={address}
								onSave={handleSaveDraft}
								onCancel={() => {
									setEditingIndex(null);
									setAddresses(draftsFromCustomer(customer));
								}}
								isSaving={isSaving}
							/>
						) : (
							<AddressRow
								address={address}
								canManage={canManage}
								isBusy={isSaving}
								onEdit={() => {
									setEditingIndex(index);
									setError(null);
								}}
								onRemove={() => setRemoveIndex(index)}
								onMakeDefault={() => void handleMakeDefault(index)}
							/>
						)}
					</li>
				))}
				{editingIndex === "new" ? (
					<li>
						<AddressEditor
							draft={{
								recipientName: customer.name,
								phoneNumber: customer.phoneNumber,
								city: customer.city,
								street: "",
								area: "",
								isDefault: addresses.length === 0,
							}}
							onSave={handleSaveDraft}
							onCancel={() => setEditingIndex(null)}
							isSaving={isSaving}
						/>
					</li>
				) : null}
			</ul>

			<ConfirmDialog
				isOpen={removeIndex !== null}
				title="Remove address?"
				message="This address will be removed from the customer's saved list."
				tone="danger"
				confirmLabel="Remove address"
				onConfirm={() => {
					if (removeIndex !== null) {
						void handleRemove(removeIndex);
					}
				}}
				onCancel={() => setRemoveIndex(null)}
			/>
		</section>
	);
}

function AddressRow({
	address,
	canManage,
	isBusy,
	onEdit,
	onRemove,
	onMakeDefault,
}: {
	address: AddressDraft;
	canManage: boolean;
	isBusy: boolean;
	onEdit: () => void;
	onRemove: () => void;
	onMakeDefault: () => void;
}) {
	return (
		<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-3">
			<div className="flex items-start gap-3">
				<span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]">
					<MapPin size={14} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold text-[var(--color-ink-900)]">{address.label || address.recipientName}</p>
						{address.isDefault ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-800)]">
								<Check size={10} strokeWidth={3} />
								Default
							</span>
						) : null}
					</div>
					<p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-600)]">
						{address.recipientName} · {address.phoneNumber}
						<br />
						{[address.street, address.area, address.city, address.postalCode].filter(Boolean).join(", ")}
					</p>
				</div>
			</div>
			{canManage ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{!address.isDefault ? (
						<Button variant="ghost" size="sm" onClick={onMakeDefault} disabled={isBusy}>
							Make default
						</Button>
					) : null}
					<Button variant="ghost" size="sm" leadingIcon={<Pencil size={12} />} onClick={onEdit} disabled={isBusy}>
						Edit
					</Button>
					<Button variant="ghost" size="sm" leadingIcon={<Trash2 size={12} />} onClick={onRemove} disabled={isBusy} className="text-rose-600 hover:text-rose-700">
						Remove
					</Button>
				</div>
			) : null}
		</div>
	);
}

function AddressEditor({
	draft,
	onSave,
	onCancel,
	isSaving,
}: {
	draft: AddressDraft;
	onSave: (draft: AddressDraft) => void | Promise<void>;
	onCancel: () => void;
	isSaving: boolean;
}) {
	const [form, setForm] = useState<AddressDraft>(draft);

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		void onSave(form);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-accent-200)] bg-[var(--color-accent-50)]/40 p-3">
			<TextField
				label="Label (optional)"
				value={form.label ?? ""}
				onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
				maxLength={FIELD_LIMITS.addressLabel}
				placeholder="Home, Office…"
			/>
			<div className="grid gap-3 sm:grid-cols-2">
				<TextField
					label="Recipient"
					value={form.recipientName}
					onChange={(event) => setForm((prev) => ({ ...prev, recipientName: event.target.value }))}
					required
					maxLength={FIELD_LIMITS.recipientName}
					placeholder="Who will receive the parcel?"
					autoComplete="name"
				/>
				<TextField
					label="Phone"
					value={form.phoneNumber}
					onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
					required
					maxLength={FIELD_LIMITS.phoneNumber}
					placeholder="+92 320 4862403"
					inputMode="tel"
					autoComplete="tel"
				/>
			</div>
			<TextField
				label="Street"
				value={form.street ?? ""}
				onChange={(event) => setForm((prev) => ({ ...prev, street: event.target.value }))}
				maxLength={FIELD_LIMITS.addressStreet}
				placeholder="House #, Street"
				autoComplete="address-line1"
			/>
			<div className="grid gap-3 sm:grid-cols-2">
				<TextField
					label="Area"
					value={form.area ?? ""}
					onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
					maxLength={FIELD_LIMITS.addressArea}
					placeholder="Sector / Block / Neighbourhood"
					autoComplete="address-line2"
				/>
				<TextField
					label="City"
					value={form.city}
					onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
					required
					maxLength={FIELD_LIMITS.city}
					placeholder="e.g. your city"
					autoComplete="address-level2"
				/>
			</div>
			<TextField
				label="Postal code"
				value={form.postalCode ?? ""}
				onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
				maxLength={FIELD_LIMITS.postalCode}
				placeholder="54000"
				autoComplete="postal-code"
				inputMode="numeric"
			/>
			<label className="flex items-center gap-2 text-xs text-[var(--color-ink-700)]">
				<input
					type="checkbox"
					checked={form.isDefault}
					onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
					className="size-3.5 rounded border-[var(--color-ink-300)]"
				/>
				Default delivery address
			</label>
			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={isSaving}>
					Cancel
				</Button>
				<Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
					Save address
				</Button>
			</div>
		</form>
	);
}
