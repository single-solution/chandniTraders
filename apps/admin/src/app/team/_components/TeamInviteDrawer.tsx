"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Switch } from "@/components/forms/Switch";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api";
import { FIELD_LIMITS } from "@store/shared";
import { ROLE_OPTIONS, ROLE_TAGLINE, ROLE_LABEL } from "@/lib/roleCatalog";
import type { AdminUser } from "@/types/models";
import type { UserRole } from "@store/db";

const EMAIL_MAX_CHARS = 320;
const PASSWORD_MAX_CHARS = 128;
const PASSWORD_MIN_CHARS = 8;
const TEAM_NAME_MAX_CHARS = FIELD_LIMITS.shortText;

interface TeamInviteDrawerProps {
	isOpen: boolean;
	isCurrentUserSuperAdmin: boolean;
	onClose: () => void;
	onCreated: (member: AdminUser) => void;
}

export function TeamInviteDrawer({ isOpen, isCurrentUserSuperAdmin, onClose, onCreated }: TeamInviteDrawerProps) {
	const toast = useToast();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [role, setRole] = useState<UserRole>("support_staff");
	const [password, setPassword] = useState("");
	const [isActive, setIsActive] = useState(true);
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	function reset() {
		setName("");
		setEmail("");
		setPhoneNumber("");
		setRole("support_staff");
		setPassword("");
		setIsActive(true);
		setIsSuperAdmin(false);
	}

	function handleClose() {
		if (isSaving) return;
		reset();
		onClose();
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSaving(true);
		try {
			if (!password) {
				throw new Error("Password is required for new members.");
			}
			const payload: Record<string, unknown> = {
				name,
				email,
				phoneNumber: phoneNumber || undefined,
				role,
				isActive,
				password,
			};
			if (isCurrentUserSuperAdmin && role === "owner") {
				payload.isSuperAdmin = isSuperAdmin;
			}
			const created = await apiFetch<AdminUser>(`/api/team`, {
				method: "POST",
				json: payload,
			});
			toast.success(`${created.name} invited`);
			reset();
			onCreated(created);
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : "Failed to invite member");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<Drawer
			isOpen={isOpen}
			onClose={handleClose}
			title="Invite team member"
			description="They'll receive admin access immediately with the role you pick below."
			width="md"
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" size="md" type="button" onClick={handleClose} disabled={isSaving}>
						Cancel
					</Button>
					<Button variant="primary" size="md" type="submit" form="team-invite-form" isLoading={isSaving}>
						Invite member
					</Button>
				</div>
			}
		>
			<form id="team-invite-form" onSubmit={handleSubmit} className="space-y-4">
				<TextField
					label="Full name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					required
					maxLength={TEAM_NAME_MAX_CHARS}
					placeholder="e.g. Sara Ahmed"
					autoComplete="name"
				/>
				<TextField
					label="Email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
					maxLength={EMAIL_MAX_CHARS}
					placeholder="teammate@yourstore.com"
					autoComplete="email"
					inputMode="email"
					hint="They'll sign in to the admin console with this address."
				/>
				<TextField
					label="Phone number"
					value={phoneNumber}
					onChange={(event) => setPhoneNumber(event.target.value)}
					maxLength={FIELD_LIMITS.phoneNumber}
					placeholder="+92 320 4862403"
					autoComplete="tel"
					inputMode="tel"
					hint="Optional — only visible to other admins."
				/>
				<SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} options={ROLE_OPTIONS} hint={ROLE_TAGLINE[role]} />
				<TextField
					label="Initial password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
					minLength={PASSWORD_MIN_CHARS}
					maxLength={PASSWORD_MAX_CHARS}
					placeholder="At least 8 characters"
					autoComplete="new-password"
					hint="Share this securely. Must be 8+ chars with at least one letter and one number."
				/>
				<Switch label="Active" description="Suspended members cannot sign in." checked={isActive} onCheckedChange={setIsActive} />
				{isCurrentUserSuperAdmin && role === "owner" ? (
					<Switch
						label="Super admin"
						description="Bypass all role-based permission checks. Only available when role is Owner."
						checked={isSuperAdmin}
						onCheckedChange={setIsSuperAdmin}
					/>
				) : null}
				<p className="rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-ink-600)]">
					Inviting <strong>{ROLE_LABEL[role]}</strong> · they will be able to do everything in that role&apos;s permission set the moment they sign in.
				</p>
			</form>
		</Drawer>
	);
}
