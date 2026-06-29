import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { classNames } from "@store/shared";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonOwnProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	isLoading?: boolean;
	leadingIcon?: ReactNode;
	trailingIcon?: ReactNode;
}

type ButtonProps = ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonLinkProps = ButtonOwnProps &
	Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
		href: string;
	};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	primary: "bg-[var(--color-accent-500)] font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-accent-600)] focus-visible:ring-[var(--color-accent-700)]",
	secondary: "bg-[var(--color-ink-900)] font-semibold text-[var(--color-canvas)] hover:bg-[var(--color-ink-800)] focus-visible:ring-[var(--color-ink-700)]",
	outline:
		"border border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-800)] hover:border-[var(--color-accent-300)] hover:text-[var(--color-accent-800)] focus-visible:ring-[var(--color-accent-300)]",
	ghost: "bg-transparent text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-accent-800)] focus-visible:ring-[var(--color-ink-300)]",
	danger: "bg-[var(--color-danger-500)] font-semibold text-white hover:bg-[var(--color-danger-700)] focus-visible:ring-[var(--color-danger-500)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: "h-9 px-3 text-sm",
	md: "h-11 px-5 text-sm",
	lg: "h-13 px-7 text-base",
};

export function Button({ variant = "primary", size = "md", isLoading = false, leadingIcon, trailingIcon, className, disabled, children, ...rest }: ButtonProps) {
	const isDisabled = disabled || isLoading;

	return (
		<button
			{...rest}
			disabled={isDisabled}
			aria-busy={isLoading || undefined}
			className={classNames(
				"tap inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				trailingIcon ? "cta-arrow" : null,
				VARIANT_CLASSES[variant],
				SIZE_CLASSES[size],
				className,
			)}
		>
			{isLoading ? <Spinner /> : leadingIcon}
			{children}
			{!isLoading && trailingIcon}
		</button>
	);
}

export function ButtonLink({ variant = "primary", size = "md", leadingIcon, trailingIcon, className, href, children, ...rest }: ButtonLinkProps) {
	return (
		<Link
			{...rest}
			href={href}
			className={classNames(
				"tap inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
				trailingIcon ? "cta-arrow" : null,
				VARIANT_CLASSES[variant],
				SIZE_CLASSES[size],
				className,
			)}
		>
			{leadingIcon}
			{children}
			{trailingIcon}
		</Link>
	);
}

function Spinner() {
	return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}
