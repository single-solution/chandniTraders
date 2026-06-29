import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "@store/shared";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	isInteractive?: boolean;
	children: ReactNode;
}

export function Card({ isInteractive = false, className, children, ...rest }: CardProps) {
	return (
		<div
			{...rest}
			/* Default outer radius is `--radius-2xl` (24px) because the
         overwhelming majority of Card consumers wrap inner controls at
         `--radius-md` (8px) inside `p-4` (16px) padding — concentric
         corners need outer = inner + padding = 8 + 16 = 24. See the
         radius scale table in `globals.css`. */
			className={classNames(
				"rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]",
				"shadow-[var(--shadow-sm)]",
				isInteractive && "lift hover:border-[var(--color-ink-200)]",
				!isInteractive && "transition-colors duration-200",
				className,
			)}
		>
			{children}
		</div>
	);
}
