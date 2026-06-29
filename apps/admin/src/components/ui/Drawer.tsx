"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames } from "@store/shared";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";

interface DrawerProps {
	isOpen: boolean;
	onClose: () => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	topBar?: ReactNode;
	width?: "sm" | "md" | "lg" | "xl" | "2xl";
	bodyClassName?: string;
	ariaLabel?: string;
}

const WIDTH_CLASSES: Record<NonNullable<DrawerProps["width"]>, string> = {
	sm: "max-w-md",
	md: "max-w-lg",
	lg: "max-w-2xl",
	xl: "max-w-3xl",
	"2xl": "max-w-5xl",
};

export function Drawer({ isOpen, onClose, title, description, children, footer, topBar, width = "md", bodyClassName, ariaLabel }: DrawerProps) {
	const [isHydrated, setIsHydrated] = useState(false);
	const { isMounted, isClosing } = useOverlayPresence(isOpen);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsHydrated(true);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen, onClose]);

	if (!isMounted || !isHydrated) {
		return null;
	}

	const drawerElement = (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
			className="fixed inset-0 z-[var(--z-modal)] flex items-stretch justify-center sm:items-center sm:justify-center sm:p-6"
		>
			<button
				type="button"
				aria-label="Close dialog"
				onClick={onClose}
				className={classNames("absolute inset-0 bg-[var(--color-ink-900)]/40", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
			/>
			<div
				className={classNames(
					"relative flex w-full flex-col overflow-hidden border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
					// Phones: edge-to-edge full-screen sheet (no rounded corners, no
					// outer margin). Tablets+: centered modal with rounded corners.
					"h-[100dvh] max-h-[100dvh] sm:rounded-[var(--radius-xl)] sm:border",
					// Mobile gets the bottom-sheet slide; tablets+ get the centered
					// dialog scale. Both CSS-only — admin avoids any JS animation
					// library so the panel stays light and fast.
					isClosing ? "animate-sheet-down sm:animate-dialog-out" : "animate-sheet-up sm:animate-dialog-in",
					width === "2xl" ? "sm:h-[min(92vh,52rem)] sm:max-h-[calc(100dvh-2rem)]" : "sm:h-[min(90vh,45rem)] sm:max-h-[calc(100dvh-3rem)]",
					WIDTH_CLASSES[width],
				)}
			>
				<header
					className="safe-top flex items-start justify-between gap-2 border-b border-[var(--color-ink-100)] px-4 py-2.5 md:gap-3 md:px-5 md:py-3"
					style={
						{
							"--safe-top-base": "0.625rem",
						} as CSSProperties
					}
				>
					<div className="min-w-0 pr-1">
						<h2 className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-ink-900)] md:text-[15px]">{title}</h2>
						{Boolean(description) && <div className="mt-0.5 max-w-prose text-[10.5px] leading-snug text-[var(--color-ink-500)] md:text-[11px]">{description}</div>}
					</div>
					{!footer && (
						<button
							type="button"
							aria-label="Close"
							onClick={onClose}
							className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-900)] md:size-7"
						>
							<X size={16} />
						</button>
					)}
				</header>

				{Boolean(topBar) && <div className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-4 py-3 md:px-5">{topBar}</div>}

				<div
					className={classNames("flex-1 overflow-y-auto px-4 py-3 md:px-5 md:py-4", !footer && "safe-bottom", bodyClassName)}
					style={
						!footer
							? ({
									"--safe-bottom-base": "0.75rem",
								} as CSSProperties)
							: undefined
					}
				>
					{children}
				</div>

				{Boolean(footer) && (
					<footer
						className="safe-bottom border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-4 py-2 md:px-5 md:py-2.5"
						style={
							{
								"--safe-bottom-base": "0.5rem",
							} as CSSProperties
						}
					>
						{footer}
					</footer>
				)}
			</div>
		</div>
	);

	return createPortal(drawerElement, document.body);
}
