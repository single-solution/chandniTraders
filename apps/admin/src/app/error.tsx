"use client";

/**
 * Admin-side error boundary.
 *
 * We surface the digest so support can correlate a report to server logs
 * without leaking the underlying message (which can include DB query
 * details we don't want to expose, even to staff).
 */
import { useEffect } from "react";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AdminErrorPage({ error, reset }: ErrorPageProps) {
	useEffect(() => {
		if (typeof window !== "undefined") {
			console.error("[admin] route error", error);
		}
	}, [error]);

	return (
		<main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
			<p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-danger-500)]">Something went wrong</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink-900)]">We hit a snag.</h1>
			<p className="mt-3 max-w-md text-sm text-[var(--color-ink-600)]">
				An unexpected error occurred while rendering this page. Try again, and if it keeps happening grab the reference code below.
			</p>
			{error.digest ? (
				<p className="mt-3 text-[11px] text-[var(--color-ink-500)]">
					Reference: <span className="font-mono">{error.digest}</span>
				</p>
			) : null}
			<button
				type="button"
				onClick={reset}
				className="mt-6 inline-flex h-10 items-center rounded-full bg-[var(--color-accent-500)] px-5 text-sm font-semibold text-[var(--color-ink-900)] transition-colors hover:bg-[var(--color-accent-600)]"
			>
				Try again
			</button>
		</main>
	);
}
