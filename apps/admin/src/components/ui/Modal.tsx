"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { classNames } from "@store/shared";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { X } from "lucide-react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = "md" }: ModalProps) {
	const [isHydrated, setIsHydrated] = useState(false);
	const { isMounted, isClosing } = useOverlayPresence(isOpen);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required for safe hydration
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
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isMounted || !isHydrated) {
		return null;
	}

	const maxWidthClass = {
		sm: "max-w-sm",
		md: "max-w-md",
		lg: "max-w-lg",
		xl: "max-w-xl",
		"2xl": "max-w-2xl",
		"3xl": "max-w-3xl",
		"4xl": "max-w-4xl",
		"5xl": "max-w-5xl",
	}[maxWidth];

	const dialogElement = (
		<div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Close modal background"
				onClick={onClose}
				className={classNames("absolute inset-0 bg-[var(--color-ink-900)]/40", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
			/>
			<div
				className={classNames(
					"relative w-full rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] flex flex-col max-h-[90vh]",
					maxWidthClass,
					isClosing ? "animate-dialog-out" : "animate-dialog-in",
				)}
			>
				<div className="flex items-center justify-between border-b border-[var(--color-ink-100)] px-5 py-4 shrink-0">
					<h2 className="text-base font-semibold leading-snug text-[var(--color-ink-900)]">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full p-1.5 text-[var(--color-ink-500)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)] transition-colors"
					>
						<X size={18} />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-5">{children}</div>
				{Boolean(footer) && <div className="border-t border-[var(--color-ink-100)] px-5 py-4 shrink-0">{footer}</div>}
			</div>
		</div>
	);

	return createPortal(dialogElement, document.body);
}
