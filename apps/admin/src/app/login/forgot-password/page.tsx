"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@store/ui";
import { TextField } from "@/components/forms/TextField";
import { useStoreSettings } from "@/lib/storeSettingsContext";

export default function ForgotPasswordPage() {
	const { siteName } = useStoreSettings();
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
	const [message, setMessage] = useState("");

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("submitting");
		setMessage("");

		try {
			const response = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() }),
			});

			const data = await response.json();

			if (!response.ok) {
				setStatus("error");
				setMessage(data.error ?? "Failed to request password reset.");
				return;
			}

			setStatus("success");
			setMessage(data.message ?? "If an account exists, a reset link has been generated. Check the server logs for the token.");
		} catch (error) {
			setStatus("error");
			setMessage("An unexpected error occurred. Please try again.");
		}
	}

	return (
		<div className="grid min-h-screen place-items-center bg-[var(--color-canvas-deep)] px-4 py-12">
			<div className="w-full max-w-sm reveal-stagger">
				<div className="reveal flex flex-col items-center gap-3">
					<span className="glass-shine grid size-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)] shadow-[var(--shadow-sm)]">
						<ShieldAlert size={20} strokeWidth={2.4} />
					</span>
					<div className="text-center leading-tight">
						<p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-700)]">Account Recovery</p>
						<p className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">{siteName}</p>
					</div>
				</div>

				<div className="reveal mt-10 rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-md)] sm:p-10">
					{status === "success" ? (
						<div className="text-center">
							<h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink-900)]">Check your email</h1>
							<p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-600)]">{message}</p>
							<div className="mt-8">
								<Link
									href="/login"
									className="cta-arrow tap inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-ink-900)] shadow-sm hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)]"
								>
									<ArrowLeft size={14} />
									Return to sign in
								</Link>
							</div>
						</div>
					) : (
						<>
							<h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-ink-900)]">Forgot password?</h1>
							<p className="mx-auto mt-2 max-w-prose text-center text-[13px] text-[var(--color-ink-500)]">
								Enter your email and we&apos;ll send you instructions to reset your password.
							</p>

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
									disabled={status === "submitting"}
									className="text-[15px]"
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
									{status === "submitting" ? "Sending..." : "Send reset link"}
								</Button>

								<div className="text-center">
									<Link href="/login" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
										<ArrowLeft size={14} />
										Back to sign in
									</Link>
								</div>
							</form>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
