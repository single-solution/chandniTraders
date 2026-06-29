"use client";

export function ActivityDetailGrid({ detail }: { detail: string }) {
	if (!detail) return null;

	// Split detail by separator if present (usually " · ")
	const parts = detail
		.split("·")
		.map((part) => part.trim())
		.filter(Boolean);

	const rows = parts.map((part) => {
		if (part.includes("→")) {
			const [left, right] = part.split("→").map((s) => s.trim());
			return { key: left, value: right };
		}
		if (part.startsWith("was ")) {
			return { key: "Previous state", value: part.replace("was ", "") };
		}
		return { key: "Update", value: part };
	});

	return (
		<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{rows.map((row, i) => (
				<div
					key={i}
					className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]/40 p-2 text-xs sm:flex-row sm:items-center sm:gap-3"
				>
					<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)] sm:w-28">{row.key}</span>
					<span className="min-w-0 break-words font-medium text-[var(--color-ink-900)]">{row.value}</span>
				</div>
			))}
		</div>
	);
}
