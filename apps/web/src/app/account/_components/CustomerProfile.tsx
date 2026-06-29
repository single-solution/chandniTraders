"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, MapPin, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@store/ui";
import { classNames } from "@store/shared";
import type { AccountAddress, AccountCustomer } from "@/lib/core/account";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

const SAVED_FLASH_MS = 1_800;

interface CustomerProfileProps {
	customer: AccountCustomer;
}

interface AddressDraft {
	label?: string;
	recipientName: string;
	phoneNumber: string;
	street?: string;
	area?: string;
	city: string;
	postalCode?: string;
	isDefault: boolean;
}

function toDraft(address: AccountAddress): AddressDraft {
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

export function CustomerProfile({ customer }: CustomerProfileProps) {
	const router = useRouter();
	const [fullName, setFullName] = useState(customer.name);
	const [city, setCity] = useState(customer.city);
	const [phone] = useState(customer.phoneNumber);

	const [addresses, setAddresses] = useState<AddressDraft[]>(customer.addresses.map(toDraft));
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isSavingAddresses, setIsSavingAddresses] = useState(false);
	const [profileError, setProfileError] = useState<string | null>(null);
	const [addressError, setAddressError] = useState<string | null>(null);
	const [hasSavedProfile, setHasSavedProfile] = useState(false);
	const [hasSavedAddresses, setHasSavedAddresses] = useState(false);

	const handleSaveProfile = async () => {
		setIsSavingProfile(true);
		setProfileError(null);
		try {
			const response = await fetch("/api/account/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: fullName.trim(), city: city.trim() }),
			});
			const data = (await response.json()) as { error?: string };
			if (!response.ok) {
				setProfileError(data.error ?? "Save failed.");
				return;
			}
			setHasSavedProfile(true);
			setTimeout(() => setHasSavedProfile(false), SAVED_FLASH_MS);
			router.refresh();
		} catch {
			setProfileError("Network error. Please try again.");
		} finally {
			setIsSavingProfile(false);
		}
	};

	const persistAddresses = async (next: AddressDraft[]) => {
		setIsSavingAddresses(true);
		setAddressError(null);
		try {
			const response = await fetch("/api/account/addresses", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ addresses: next }),
			});
			const data = (await response.json()) as { error?: string };
			if (!response.ok) {
				setAddressError(data.error ?? "Save failed.");
				return false;
			}
			setHasSavedAddresses(true);
			setTimeout(() => setHasSavedAddresses(false), SAVED_FLASH_MS);
			router.refresh();
			return true;
		} catch {
			setAddressError("Network error. Please try again.");
			return false;
		} finally {
			setIsSavingAddresses(false);
		}
	};

	const handleAddAddress = () => {
		setAddresses((prev) => [
			...prev,
			{
				recipientName: fullName,
				phoneNumber: phone,
				street: "",
				area: "",
				city: city,
				isDefault: prev.length === 0,
			},
		]);
		setEditingIndex(addresses.length);
	};

	const handleRemoveAddress = async (index: number) => {
		const previous = addresses;
		const next = addresses.filter((_, i) => i !== index);
		if (addresses[index]?.isDefault && next.length > 0) {
			next[0].isDefault = true;
		}
		setAddresses(next);
		const saved = await persistAddresses(next);
		if (!saved) {
			// Server rejected the change — restore the list so the UI never shows an
			// edit that wasn't persisted.
			setAddresses(previous);
		}
	};

	const handleSaveAddress = async (index: number, draft: AddressDraft) => {
		const previous = addresses;
		const next = addresses.map((address, i) => (i === index ? draft : address));
		setAddresses(next);
		setEditingIndex(null);
		const saved = await persistAddresses(next);
		if (!saved) {
			setAddresses(previous);
			setEditingIndex(index);
		}
	};

	const handleMakeDefault = async (index: number) => {
		const previous = addresses;
		const next = addresses.map((address, i) => ({ ...address, isDefault: i === index }));
		setAddresses(next);
		const saved = await persistAddresses(next);
		if (!saved) {
			setAddresses(previous);
		}
	};

	return (
		<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-4 md:pb-16 md:pt-10`}>
			<Link href="/account" className="cta-arrow tap inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]">
				<ArrowLeft size={13} />
				Back to account
			</Link>
			<div className="reveal mt-2">
				<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">Profile</p>
				<h1 className="mt-1 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">Your details</h1>
				<p className="mt-1 max-w-prose text-[13px] text-[var(--color-ink-500)] md:text-sm">Manage your contact information and saved addresses.</p>
			</div>

			<Card className="reveal mt-5 p-4 md:mt-6 md:p-5">
				<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Contact</p>
				<div className="mt-3 grid gap-3 md:grid-cols-2">
					<Field
						label="Full name"
						icon={<User size={14} />}
						value={fullName}
						onChange={setFullName}
						autoComplete="name"
						placeholder="As you want it on receipts"
						isLoading={isSavingProfile}
						disabled={isSavingProfile}
					/>
					<Field label="Phone (verified)" icon={<Phone size={14} />} value={phone} onChange={() => {}} autoComplete="tel" inputMode="tel" disabled />
					<Field
						label="City"
						icon={<Building2 size={14} />}
						value={city}
						onChange={setCity}
						autoComplete="address-level2"
						placeholder="e.g. your city"
						isLoading={isSavingProfile}
						disabled={isSavingProfile}
					/>
				</div>
				{profileError && <ErrorBanner message={profileError} />}
				<div className="mt-4 flex items-center justify-between gap-3">
					<p className="max-w-prose text-[11.5px] text-[var(--color-ink-500)]">We&rsquo;ll only use these to update you about your orders.</p>
					<Button
						variant="primary"
						size="sm"
						onClick={handleSaveProfile}
						isLoading={isSavingProfile}
						leadingIcon={hasSavedProfile ? <Check size={13} strokeWidth={3} /> : undefined}
						disabled={isSavingProfile || !fullName.trim() || !city.trim()}
					>
						{hasSavedProfile ? "Saved" : "Save changes"}
					</Button>
				</div>
			</Card>

			<div className="reveal mt-5 flex items-end justify-between md:mt-6">
				<p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
					Saved addresses
					{hasSavedAddresses && (
						<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-success-50)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-success-800)]">
							<Check size={10} strokeWidth={3.2} />
							Saved
						</span>
					)}
				</p>
				<Button variant="ghost" size="sm" onClick={handleAddAddress} leadingIcon={<Plus size={13} />} disabled={isSavingAddresses}>
					Add address
				</Button>
			</div>
			{addressError && <ErrorBanner message={addressError} />}

			<ul className="reveal-stagger cv-auto mt-3 space-y-3">
				{addresses.length === 0 ? (
					<li className="reveal">
						<Card className="p-6 text-center text-[12.5px] text-[var(--color-ink-500)]">No saved addresses yet — add one to speed up future checkouts.</Card>
					</li>
				) : (
					addresses.map((address, index) => (
						<li key={index} className="reveal">
							{editingIndex === index ? (
								<AddressEditor draft={address} onSave={(draft) => handleSaveAddress(index, draft)} onCancel={() => setEditingIndex(null)} isSaving={isSavingAddresses} />
							) : (
								<AddressRow
									address={address}
									isDefault={address.isDefault}
									onMakeDefault={() => handleMakeDefault(index)}
									onEdit={() => setEditingIndex(index)}
									onRemove={() => handleRemoveAddress(index)}
									disableRemove={addresses.length <= 1}
									isBusy={isSavingAddresses}
								/>
							)}
						</li>
					))
				)}
			</ul>
		</div>
	);
}

function ErrorBanner({ message }: { message: string }) {
	return (
		<p
			role="alert"
			className="animate-banner-in mt-3 rounded-[var(--radius-md)] border border-[var(--color-danger-100)] bg-[var(--color-danger-50)] px-3 py-2 text-[12.5px] text-[var(--color-danger-800)]"
		>
			{message}
		</p>
	);
}

interface AddressRowProps {
	address: AddressDraft;
	isDefault: boolean;
	onMakeDefault: () => void;
	onEdit: () => void;
	onRemove: () => void;
	disableRemove: boolean;
	isBusy: boolean;
}

function AddressRow({ address, isDefault, onMakeDefault, onEdit, onRemove, disableRemove, isBusy }: AddressRowProps) {
	const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
	return (
		<Card className="p-4 md:p-5">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] text-[var(--color-ink-700)]">
					<MapPin size={14} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-[14px] font-semibold text-[var(--color-ink-900)]">{address.recipientName}</p>
						{isDefault && (
							<span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-100)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-accent-800)]">
								<Check size={10} strokeWidth={3.2} />
								Default
							</span>
						)}
					</div>
					<p className="mt-0.5 text-[12.5px] leading-snug text-[var(--color-ink-600)]">
						{[address.street, address.area].filter(Boolean).join(", ")}
						<br />
						{address.city} · {address.phoneNumber}
					</p>
				</div>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				{isConfirmingRemove ? (
					<>
						<p className="text-[12.5px] font-medium text-[var(--color-ink-700)]">Remove this address?</p>
						<Button variant="ghost" size="sm" onClick={() => setIsConfirmingRemove(false)} disabled={isBusy}>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							leadingIcon={!isBusy ? <Trash2 size={12} /> : undefined}
							onClick={() => {
								setIsConfirmingRemove(false);
								onRemove();
							}}
							disabled={isBusy}
							isLoading={isBusy}
						>
							{isBusy ? "Removing…" : "Confirm remove"}
						</Button>
					</>
				) : (
					<>
						{!isDefault && (
							<Button variant="ghost" size="sm" onClick={onMakeDefault} disabled={isBusy} isLoading={isBusy}>
								{isBusy ? "Updating…" : "Make default"}
							</Button>
						)}
						<Button variant="outline" size="sm" leadingIcon={<Pencil size={12} />} onClick={onEdit} disabled={isBusy}>
							Edit
						</Button>
						<Button variant="ghost" size="sm" leadingIcon={<Trash2 size={12} />} onClick={() => setIsConfirmingRemove(true)} disabled={isBusy || disableRemove}>
							Remove
						</Button>
					</>
				)}
			</div>
		</Card>
	);
}

interface AddressEditorProps {
	draft: AddressDraft;
	onSave: (draft: AddressDraft) => void;
	onCancel: () => void;
	isSaving: boolean;
}

function AddressEditor({ draft, onSave, onCancel, isSaving }: AddressEditorProps) {
	const [recipientName, setRecipientName] = useState(draft.recipientName);
	const [phoneNumber, setPhoneNumber] = useState(draft.phoneNumber);
	const [street, setStreet] = useState(draft.street ?? "");
	const [area, setArea] = useState(draft.area ?? "");
	const [city, setCity] = useState(draft.city);
	const [postalCode, setPostalCode] = useState(draft.postalCode ?? "");

	const isValid = recipientName.trim() && phoneNumber.trim() && street.trim() && city.trim();

	return (
		<Card className="p-4 md:p-5">
			<div className="grid gap-3 md:grid-cols-2">
				<Field
					label="Full name"
					icon={<User size={14} />}
					value={recipientName}
					onChange={setRecipientName}
					autoComplete="name"
					placeholder="Who will receive this parcel?"
					isLoading={isSaving}
					disabled={isSaving}
				/>
				<Field
					label="Phone"
					icon={<Phone size={14} />}
					value={phoneNumber}
					onChange={setPhoneNumber}
					inputMode="tel"
					autoComplete="tel"
					placeholder="+92 320 4862403"
					isLoading={isSaving}
					disabled={isSaving}
				/>
				<div className="md:col-span-2">
					<Field
						label="Street / house"
						icon={<Building2 size={14} />}
						value={street}
						onChange={setStreet}
						placeholder="House #, Street"
						autoComplete="address-line1"
						isLoading={isSaving}
						disabled={isSaving}
					/>
				</div>
				<div className="md:col-span-2">
					<Field
						label="Area / sector (optional)"
						value={area}
						onChange={setArea}
						placeholder="Sector / Block / Neighbourhood"
						autoComplete="address-line2"
						isLoading={isSaving}
						disabled={isSaving}
					/>
				</div>
				<Field label="City" value={city} onChange={setCity} placeholder="e.g. your city" autoComplete="address-level2" isLoading={isSaving} disabled={isSaving} />
				<Field
					label="Postcode (optional)"
					value={postalCode}
					onChange={setPostalCode}
					placeholder="54000"
					inputMode="numeric"
					autoComplete="postal-code"
					isLoading={isSaving}
					disabled={isSaving}
				/>
			</div>
			<div className="mt-4 flex items-center justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
					Cancel
				</Button>
				<Button
					variant="primary"
					size="sm"
					isLoading={isSaving}
					onClick={() =>
						onSave({
							recipientName: recipientName.trim(),
							phoneNumber: phoneNumber.trim(),
							street: street.trim() || undefined,
							area: area.trim() || undefined,
							city: city.trim(),
							postalCode: postalCode.trim() || undefined,
							isDefault: draft.isDefault,
						})
					}
					disabled={!isValid || isSaving}
				>
					Save address
				</Button>
			</div>
		</Card>
	);
}

interface FieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	icon?: React.ReactNode;
	autoComplete?: string;
	inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
	placeholder?: string;
	disabled?: boolean;
	isLoading?: boolean;
}

function Field({ label, value, onChange, icon, autoComplete, inputMode, placeholder, disabled, isLoading }: FieldProps) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{label}</span>
			<span className="relative block">
				{icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">{icon}</span>}
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					autoComplete={autoComplete}
					inputMode={inputMode}
					placeholder={placeholder}
					disabled={disabled || isLoading}
					className={classNames(
						"h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas)] text-sm text-[var(--color-ink-900)] transition-colors placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]/30 disabled:cursor-not-allowed disabled:bg-[var(--color-canvas-deep)] disabled:text-[var(--color-ink-500)]",
						icon ? "pl-9 pr-3" : "px-3.5",
						isLoading ? "pr-10" : "",
					)}
				/>
				{isLoading && (
					<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">
						<span className="block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
					</span>
				)}
			</span>
		</label>
	);
}
