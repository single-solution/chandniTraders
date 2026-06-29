"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames } from "@store/shared";

import { usePresence } from "@/components/shared/motion/usePresence";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

/** Matches the `sheet-down` / `sheet-fade-out` exit duration in globals.css. */
const SHEET_EXIT_MS = 240;

interface BottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	height?: "auto" | "sm" | "md" | "lg" | "full";
	showHandle?: boolean;
	showCloseButton?: boolean;
	contentClassName?: string;
}

const HEIGHT_CLASSES: Record<NonNullable<BottomSheetProps["height"]>, string> = {
	auto: "max-h-[85vh]",
	sm: "h-[50vh]",
	md: "h-[70vh]",
	lg: "h-[88vh]",
	full: "h-[100dvh]",
};

export function BottomSheet({
	isOpen,
	onClose,
	title,
	description,
	children,
	footer,
	height = "auto",
	showHandle = true,
	showCloseButton = true,
	contentClassName,
}: BottomSheetProps) {
	const { isMounted, status } = usePresence(isOpen, SHEET_EXIT_MS);
	const isClosing = status === "closing";
	const dialogRef = useRef<HTMLDivElement>(null);
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required for safe hydration
		setIsHydrated(true);
	}, []);

	useFocusTrap(dialogRef, isOpen);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	if (!isMounted || !isHydrated) {
		return null;
	}

	const isFull = height === "full";

	const sheetElement = (
		<div className="fixed inset-0 z-[var(--z-modal)] flex flex-col justify-end md:hidden">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className={classNames("absolute inset-0 bg-[var(--color-ink-900)]/40", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
			/>

			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className={classNames(
					"relative flex flex-col overflow-hidden bg-[var(--color-canvas)] shadow-[var(--shadow-lg)] outline-none",
					isClosing ? "animate-sheet-down" : "animate-sheet-up",
					HEIGHT_CLASSES[height],
					isFull ? "rounded-none" : "rounded-t-[var(--radius-xl)]",
				)}
			>
				{showHandle && !isFull && (
					<div className="flex justify-center pt-2.5 pb-1.5">
						<span className="h-1 w-10 rounded-full bg-[var(--color-ink-200)]" />
					</div>
				)}

				{(title || showCloseButton) && (
					<div className={classNames("flex items-start gap-3 px-5", isFull ? "safe-top h-14 items-center border-b border-[var(--color-ink-100)]" : "pt-2 pb-3")}>
						{title && (
							<div className="min-w-0 flex-1">
								<h2 className="text-base font-semibold tracking-tight text-[var(--color-ink-900)]">{title}</h2>
								{description && <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{description}</p>}
							</div>
						)}
						{showCloseButton && (
							<button
								type="button"
								aria-label="Close"
								onClick={onClose}
								className="tap focus-ring -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-ink-600)] transition-colors hover:bg-[var(--color-canvas-deep)] active:bg-[var(--color-surface-muted)]"
							>
								<X size={18} />
							</button>
						)}
					</div>
				)}

				<div className={classNames("sheet-stagger flex-1 overflow-y-auto overscroll-contain px-5 pb-6", contentClassName)}>{children}</div>

				{footer && (
					<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
						{footer}
					</div>
				)}
			</div>
		</div>
	);

	return createPortal(sheetElement, document.body);
}
