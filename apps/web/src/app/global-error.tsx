"use client";

/**
 * Last-resort error boundary that fires when even the root layout throws.
 *
 * This component renders its own `<html>` / `<body>` because Next can no
 * longer rely on the broken layout. Keep styling inline — no Tailwind — so
 * this always renders even when the rest of the app's import graph fails.
 */
import { resolvePublicErrorDisplay } from "@/lib/errors/publicErrorMessage";

interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

/* Every hex literal below is mirrored from the official palette so this
   boundary stays brand-correct even when no CSS variables are loaded.
     #f8fbf8 -> --color-canvas
     #00272c -> --color-ink-900
     #3a4d00 -> --color-accent-700
     #3f4a4c -> --color-ink-600
     #5b6669 -> --color-ink-500
     #e1ff51 -> --color-accent-500 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
	const copy = resolvePublicErrorDisplay(error);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
					background: "#f8fbf8",
					color: "#00272c",
				}}
			>
				<main
					style={{
						minHeight: "100vh",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "2rem",
					}}
				>
					<div style={{ textAlign: "center", maxWidth: "32rem" }}>
						<p
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.25em",
								textTransform: "uppercase",
								color: "#3a4d00",
							}}
						>
							{copy.eyebrow}
						</p>
						<h1 style={{ marginTop: "0.5rem", fontSize: "2rem" }}>{copy.title}</h1>
						<p style={{ marginTop: "0.75rem", color: "#3f4a4c" }}>{copy.detail}</p>
						{error.digest ? (
							<p
								style={{
									marginTop: "0.75rem",
									fontSize: "0.75rem",
									color: "#5b6669",
								}}
							>
								Reference: <code>{error.digest}</code>
							</p>
						) : null}
						<button
							type="button"
							onClick={reset}
							style={{
								marginTop: "1.5rem",
								padding: "0.6rem 1.25rem",
								background: "#e1ff51",
								color: "#00272c",
								border: "none",
								borderRadius: "9999px",
								fontWeight: 600,
								cursor: "pointer",
							}}
						>
							Retry
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
