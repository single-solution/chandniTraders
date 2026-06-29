"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/forms/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api";
import { FIELD_LIMITS } from "@store/shared";
import type { AdminCustomer } from "@/types/models";
import { CustomerErrorBanner } from "./customerDetailUi";

/** Upper bound for the starter loyalty grant on a manual account. Mirrors the
 *  server cap so the field can't submit a value the API will reject. */
const LOYALTY_POINTS_MAX = 1_000_000;

interface CustomerCreateDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	onCreated: (customer: AdminCustomer) => void;
}

export function CustomerCreateDrawer({ isOpen, onClose, onCreated }: CustomerCreateDrawerProps) {
	const toast = useToast();
	const [name, setName] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [city, setCity] = useState("");
	const [loyaltyPoints, setLoyaltyPoints] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setName("");
		setPhoneNumber("");
		setCity("");
		setLoyaltyPoints("");
		setError(null);
	}

	function handleClose() {
		if (isSaving) return;
		reset();
		onClose();
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSaving(true);
		setError(null);
		const parsedPoints = Number.parseInt(loyaltyPoints, 10);
		const loyaltyPointsValue = Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : undefined;
		try {
			const created = await apiFetch<AdminCustomer>("/api/customers", {
				method: "POST",
				json: {
					name,
					phoneNumber,
					city: city || undefined,
					loyaltyPoints: loyaltyPointsValue,
				},
			});
			toast.success(`${created.name} added`);
			reset();
			onCreated(created);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to create customer");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<Drawer
			isOpen={isOpen}
			onClose={handleClose}
			title="New customer"
			description="Set up an account for someone who can't self-register on the storefront. Their phone number is their sign-in ID."
			width="md"
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" size="md" type="button" onClick={handleClose} disabled={isSaving}>
						Cancel
					</Button>
					<Button variant="primary" size="md" type="submit" form="customer-create-form" isLoading={isSaving}>
						Create customer
					</Button>
				</div>
			}
		>
			<form id="customer-create-form" onSubmit={handleSubmit} className="space-y-4">
				{error ? <CustomerErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
				<TextField
					label="Full name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					required
					maxLength={FIELD_LIMITS.personName}
					placeholder="As they want it on invoices"
					autoComplete="name"
				/>
				<TextField
					label="Phone (sign-in ID)"
					value={phoneNumber}
					onChange={(event) => setPhoneNumber(event.target.value)}
					required
					maxLength={FIELD_LIMITS.phoneNumber}
					placeholder="+92 320 4862403"
					inputMode="tel"
					autoComplete="tel"
					hint="The customer signs in with this number. They can't change it later from admin."
				/>
				<TextField
					label="City"
					value={city}
					onChange={(event) => setCity(event.target.value)}
					maxLength={FIELD_LIMITS.city}
					placeholder="Optional"
					autoComplete="address-level2"
					hint="Optional — they can fill this in at checkout."
				/>
				<TextField
					label="Loyalty points"
					type="number"
					value={loyaltyPoints}
					onChange={(event) => setLoyaltyPoints(event.target.value)}
					min={0}
					max={LOYALTY_POINTS_MAX}
					step={1}
					placeholder="0"
					inputMode="numeric"
					hint="Optional — credits a starter balance and enrolls them in loyalty. Leave at 0 for none."
				/>
				<p className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-ink-600)]">
					After creating, open the profile and use <strong>Sign-in code</strong> to hand the customer a code they can enter on the storefront login.
				</p>
			</form>
		</Drawer>
	);
}
