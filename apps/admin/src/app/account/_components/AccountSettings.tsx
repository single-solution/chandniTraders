"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserCircle } from "lucide-react";

import { Button } from "@store/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { useToast } from "@/components/ui/Toast";
import { WorkspaceFrame, WorkspaceListHeader } from "@/components/shared/workspaceUi";
import { apiFetch, ApiError } from "@/lib/api";
import { formatRole } from "@/lib/initials";
import { FIELD_LIMITS } from "@store/shared";
import type { AdminUser } from "@/types/models";

const EMAIL_MAX_CHARS = 320;
const PASSWORD_MAX_CHARS = 128;
const PASSWORD_MIN_CHARS = 8;

const ROLE_LABEL: Record<AdminUser["role"], string> = {
	owner: "Owner",
	business_manager: "Business manager",
	product_manager: "Product manager",
	marketing_manager: "Marketing manager",
	support_staff: "Support staff",
};

export function AccountSettings() {
	const router = useRouter();
	const toast = useToast();
	const { data: session, update: updateSession } = useSession();

	const [loading, setLoading] = useState(true);
	const [profileSaving, setProfileSaving] = useState(false);
	const [passwordSaving, setPasswordSaving] = useState(false);

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [roleLabel, setRoleLabel] = useState("");

	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");

	useEffect(() => {
		let cancelled = false;
		apiFetch<AdminUser>("/api/account")
			.then((account) => {
				if (cancelled) return;
				setName(account.name);
				setEmail(account.email);
				setPhoneNumber(account.phoneNumber ?? "");
				setRoleLabel(account.isSuperAdmin ? "Owner" : (ROLE_LABEL[account.role] ?? formatRole(account.role)));
			})
			.catch((error) => {
				if (cancelled) return;
				toast.danger(error instanceof ApiError ? error.message : "Failed to load your account.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [toast]);

	async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (profileSaving) return;
		setProfileSaving(true);
		try {
			const updated = await apiFetch<AdminUser>("/api/account", {
				method: "PUT",
				json: {
					name: name.trim(),
					email: email.trim(),
					phoneNumber: phoneNumber.trim() || undefined,
				},
			});
			await updateSession({
				name: updated.name,
				email: updated.email,
			});
			toast.success("Profile updated.");
			router.refresh();
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to update profile.");
		} finally {
			setProfileSaving(false);
		}
	}

	async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (passwordSaving) return;
		if (password !== passwordConfirm) {
			toast.danger("Passwords do not match.");
			return;
		}
		setPasswordSaving(true);
		try {
			await apiFetch("/api/account", {
				method: "PUT",
				json: { password },
			});
			setPassword("");
			setPasswordConfirm("");
			toast.success("Password updated.");
		} catch (error) {
			toast.danger(error instanceof ApiError ? error.message : "Failed to update password.");
		} finally {
			setPasswordSaving(false);
		}
	}

	if (loading) {
		return (
			<WorkspaceFrame minHeight={false}>
				<WorkspaceListHeader iconElement={<UserCircle size={15} />} title="Your profile" subtitle="Manage your name, email, and admin sign-in password." />
				<div className="mx-auto w-full max-w-3xl p-4 md:p-5">
					<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-sm)] md:px-6">
						{Array.from({ length: 2 }).map((_, section) => (
							<div key={section} className="grid gap-5 border-b border-[var(--color-ink-100)] py-6 first:pt-6 last:border-b-0 lg:grid-cols-[220px_minmax(0,360px)] lg:gap-10">
								<div>
									<Skeleton shape="text" className="h-4 w-24" />
									<Skeleton shape="text" className="mt-2 h-3 w-44" />
								</div>
								<div className="space-y-3">
									{Array.from({ length: 3 }).map((__, field) => (
										<Skeleton key={field} shape="text" className="h-9 w-full" />
									))}
									<Skeleton shape="text" className="h-9 w-28" />
								</div>
							</div>
						))}
					</div>
				</div>
			</WorkspaceFrame>
		);
	}

	return (
		<WorkspaceFrame minHeight={false}>
			<WorkspaceListHeader iconElement={<UserCircle size={15} />} title="Your profile" subtitle="Manage your name, email, and admin sign-in password." />
			<div className="mx-auto w-full max-w-3xl p-4 md:p-5">
				<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-sm)] md:px-6">
					<form onSubmit={handleProfileSubmit}>
						<FormSection title="Profile" description="Update how you appear in the admin console. Email is used for password resets.">
							<TextField
								label="Full name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								maxLength={FIELD_LIMITS.shortText}
								placeholder="e.g. Ali Khan"
								autoComplete="name"
							/>
							<TextField
								label="Email"
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								maxLength={EMAIL_MAX_CHARS}
								placeholder="you@store.example"
								autoComplete="email"
								inputMode="email"
							/>
							<TextField
								label="Phone number"
								value={phoneNumber}
								onChange={(event) => setPhoneNumber(event.target.value)}
								maxLength={FIELD_LIMITS.phoneNumber}
								placeholder="+92 320 4862403"
								autoComplete="tel"
								inputMode="tel"
								hint="Optional. Only visible to other admins on the Team page."
							/>
							<p className="text-xs text-[var(--color-ink-500)]">
								Role: <span className="font-semibold text-[var(--color-ink-800)]">{roleLabel}</span>
								{session?.user?.isSuperAdmin ? null : <span className="block pt-0.5">Contact an owner to change your role or access level.</span>}
							</p>
							<div className="flex justify-end">
								<Button type="submit" variant="primary" size="sm" isLoading={profileSaving}>
									Save profile
								</Button>
							</div>
						</FormSection>
					</form>

					<form id="password" onSubmit={handlePasswordSubmit} className="scroll-mt-4">
						<FormSection title="Password" description="Choose a new password for signing in to the admin console. Minimum 8 characters.">
							<TextField
								label="New password"
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								minLength={PASSWORD_MIN_CHARS}
								maxLength={PASSWORD_MAX_CHARS}
								placeholder="At least 8 characters"
								autoComplete="new-password"
							/>
							<TextField
								label="Confirm new password"
								type="password"
								value={passwordConfirm}
								onChange={(event) => setPasswordConfirm(event.target.value)}
								required
								minLength={PASSWORD_MIN_CHARS}
								maxLength={PASSWORD_MAX_CHARS}
								placeholder="Re-enter the password above"
								autoComplete="new-password"
								hint="Must match the new password above."
							/>
							<div className="flex justify-end">
								<Button type="submit" variant="primary" size="sm" isLoading={passwordSaving}>
									Update password
								</Button>
							</div>
						</FormSection>
					</form>
				</div>
			</div>
		</WorkspaceFrame>
	);
}
