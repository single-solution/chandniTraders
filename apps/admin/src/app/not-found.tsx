import Link from "next/link";

export default function AdminNotFound() {
	return (
		<main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
			<p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-ink-500)]">404</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink-900)]">We can&apos;t find that admin page.</h1>
			<p className="mt-3 max-w-md text-sm text-[var(--color-ink-600)]">The link you followed may be broken, or the page may have been moved.</p>
			<Link
				href="/"
				className="mt-6 inline-flex h-10 items-center rounded-full bg-[var(--color-accent-500)] px-5 text-sm font-semibold text-[var(--color-ink-900)] transition-colors hover:bg-[var(--color-accent-600)]"
			>
				Back to dashboard
			</Link>
		</main>
	);
}
