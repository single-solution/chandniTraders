"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowRight, Lock, Mail, ShoppingBag } from "lucide-react";
import { Button } from "@store/ui";
import { TextField } from "@/components/forms/TextField";
import { useStoreSettings } from "@/lib/storeSettingsContext";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export default function AdminLoginPage() {
	const { siteName } = useStoreSettings();
	return (
		<div className="grid min-h-screen place-items-center bg-[var(--color-canvas-deep)] px-4 py-12">
			<div className="w-full max-w-sm reveal-stagger">
				<div className="reveal flex flex-col items-center gap-3">
					<span className="glass-shine grid size-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)] shadow-[var(--shadow-sm)]">
						<ShoppingBag size={20} strokeWidth={2.4} />
					</span>
					<div className="text-center leading-tight">
						<p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-700)]">Admin console</p>
						<p className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">{siteName}</p>
					</div>
				</div>

				<div className="reveal mt-10 rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-md)] sm:p-10">
					<h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-ink-900)]">Sign in</h1>
					<p className="mx-auto mt-2 max-w-prose text-center text-[13px] text-[var(--color-ink-500)]">Use the email and password your owner shared with you.</p>

					<Suspense fallback={<LoginFormSkeleton />}>
						<LoginForm />
					</Suspense>
				</div>

				<p className="reveal mx-auto mt-8 max-w-prose text-center text-[12px] text-[var(--color-ink-400)]">
					© {new Date().getFullYear()} {siteName} ·{" "}
					<Link href="/login/forgot-password" className="font-medium hover:text-[var(--color-ink-600)] underline underline-offset-2 transition-colors">
						Forgot password?
					</Link>
				</p>
			</div>
		</div>
	);
}

function LoginFormSkeleton() {
	return (
		<div className="mt-7 space-y-5">
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

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	// Only honour same-origin paths so the login page can't be turned into an
	// open redirect (e.g. ?callbackUrl=https://evil.example).
	const requestedCallback = searchParams.get("callbackUrl");
	const callbackUrl = requestedCallback && requestedCallback.startsWith("/") && !requestedCallback.startsWith("//") ? requestedCallback : "/";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);

		const result = await signIn("credentials", {
			email: email.trim(),
			password,
			redirect: false,
		});

		if (!result || result.error) {
			setError(GENERIC_LOGIN_ERROR);
			setIsSubmitting(false);
			return;
		}

		router.replace(callbackUrl);
		router.refresh();
	}

	return (
		<form onSubmit={handleSubmit} className="mt-8 space-y-6">
			<TextField
				label="Email"
				type="email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				leadingIcon={<Mail size={16} />}
				placeholder="you@store.example"
				autoComplete="email"
				inputMode="email"
				required
				disabled={isSubmitting}
				className="text-[15px]"
			/>
			<TextField
				label="Password"
				type="password"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				leadingIcon={<Lock size={16} />}
				placeholder="Your admin password"
				autoComplete="current-password"
				required
				disabled={isSubmitting}
				className="text-[15px]"
			/>

			{error ? (
				<p
					role="alert"
					className="animate-banner-in rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2.5 text-[13px] font-medium text-[var(--color-danger-700)]"
				>
					{error}
				</p>
			) : null}

			<Button
				type="submit"
				variant="primary"
				size="lg"
				className="w-full shadow-[var(--shadow-sm)]"
				isLoading={isSubmitting}
				trailingIcon={!isSubmitting ? <ArrowRight size={16} /> : undefined}
			>
				{isSubmitting ? "Signing in…" : "Sign in"}
			</Button>
		</form>
	);
}
