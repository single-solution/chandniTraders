"use client";

interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AdminGlobalError({ error, reset }: GlobalErrorProps) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
					background: "#f5f5f4",
					color: "#171717",
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
								color: "#b91c1c",
							}}
						>
							Critical error
						</p>
						<h1 style={{ marginTop: "0.5rem", fontSize: "2rem" }}>The admin app failed to load.</h1>
						{error.digest ? (
							<p
								style={{
									marginTop: "0.75rem",
									fontSize: "0.75rem",
									color: "#737373",
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
								background: "#171717",
								color: "#fafafa",
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
