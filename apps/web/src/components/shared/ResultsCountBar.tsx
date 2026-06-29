import { classNames } from "@store/shared";

interface ResultsCountBarProps {
	total: number;
	page: number;
	pageSize: number;
	hideOnMobile?: boolean;
}

/**
 * Tiny "Showing 1–24 of 87" bar shown above the product grid. Renders
 * nothing when `total === 0` so the empty-state component is the only
 * thing the user sees.
 */
export function ResultsCountBar({ total, page, pageSize, hideOnMobile = false }: ResultsCountBarProps) {
	if (total === 0) {
		return null;
	}
	const start = (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, total);
	return (
		<p className={classNames("mt-5 text-[12.5px] tracking-wide text-[var(--color-ink-500)] md:mt-0", hideOnMobile && "hidden md:block")}>
			Showing <span className="font-semibold tabular-nums text-[var(--color-accent-800)]">{start}</span>–
			<span className="font-semibold tabular-nums text-[var(--color-accent-800)]">{end}</span> of{" "}
			<span className="font-semibold tabular-nums text-[var(--color-accent-800)]">{total}</span>
		</p>
	);
}
