"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, KeyRound } from "lucide-react";
import { Button } from "@store/ui";
import { TextField } from "@/components/forms/TextField";
import { useStoreSettings } from "@/lib/storeSettingsContext";

export default function ResetPasswordPage() {
	const { siteName } = useStoreSettings();

	return (
		<div className="grid min-h-screen place-items-center bg-[var(--color-canvas-deep)] px-4 py-12">
			<div className="w-full max-w-sm reveal-stagger">
				<div className="reveal flex flex-col items-center gap-3">
					<span className="glass-shine grid size-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)] shadow-[var(--shadow-sm)]">
						<KeyRound size={20} strokeWidth={2.4} />
					</span>
					<div className="text-center leading-tight">
						<p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-700)]">Account Recovery</p>
						<p className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">{siteName}</p>
					</div>
				</div>

				<div className="reveal mt-10 rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-md)] sm:p-10">
					<Suspense fallback={<ResetFormSkeleton />}>
						<ResetPasswordForm />
					</Suspense>
				</div>
			</div>
		</div>
	);
}

function ResetFormSkeleton() {
	return (
		<div className="space-y-5">
			<div className="h-7 w-32 animate-pulse rounded bg-[var(--color-canvas-deep)] mx-auto mb-2" />
			{Array.from({ length: 2 }).map((_, index) => (
				<div key={index} className="space-y-1.5">
					<div className="h-3 w-16 animate-pulse rounded bg-[var(--color-canvas-deep)]" />
					<div className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)]" />
				</div>
			))}
			<div className="h-11 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)]" />
		</div>
	);
}

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const [password, setPassword] = useState("");
	const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
	const [message, setMessage] = useState("");

	if (!token) {
		return (
			<div className="text-center">
				<h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">Invalid link</h1>
				<p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-600)]">This password reset link is missing its secure token. Please request a new link.</p>
				<div className="mt-8">
					<Link
						href="/login/forgot-password"
						className="cta-arrow tap inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-ink-900)] shadow-sm hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)]"
					>
						Request new link
						<ArrowRight size={14} />
					</Link>
				</div>
			</div>
		);
	}

	if (status === "success") {
		return (
			<div className="text-center">
				<h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">Password updated</h1>
				<p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-600)]">Your password has been successfully reset. You can now sign in with your new password.</p>
				<div className="mt-8">
					<Link
						href="/login"
						className="cta-arrow tap inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-ink-900)] shadow-sm hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)]"
					>
						Go to sign in
						<ArrowRight size={14} />
					</Link>
				</div>
			</div>
		);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("submitting");
		setMessage("");

		try {
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setStatus("error");
				setMessage(data.error ?? "Failed to reset password.");
				return;
			}

			setStatus("success");
		} catch (error) {
			setStatus("error");
			setMessage("An unexpected error occurred. Please try again.");
		}
	}

	return (
		<>
			<h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-ink-900)]">Choose new password</h1>
			<p className="mx-auto mt-2 max-w-prose text-center text-[13px] text-[var(--color-ink-500)]">Create a new secure password for your account.</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-6">
				<TextField
					label="New Password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					leadingIcon={<Lock size={16} />}
					placeholder="Enter new password"
					autoComplete="new-password"
					required
					disabled={status === "submitting"}
					className="text-[15px]"
					hint="Must be at least 8 characters long."
				/>

				{status === "error" ? (
					<p
						role="alert"
						className="animate-banner-in rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2.5 text-[13px] font-medium text-[var(--color-danger-700)]"
					>
						{message}
					</p>
				) : null}

				<Button
					type="submit"
					variant="primary"
					size="lg"
					className="w-full shadow-[var(--shadow-sm)]"
					isLoading={status === "submitting"}
					trailingIcon={status !== "submitting" ? <ArrowRight size={16} /> : undefined}
				>
					{status === "submitting" ? "Updating..." : "Update password"}
				</Button>
			</form>
		</>
	);
}
