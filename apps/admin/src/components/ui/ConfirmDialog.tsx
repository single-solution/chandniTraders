"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { classNames } from "@store/shared";
import { Button } from "@store/ui";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: "danger" | "default";
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onConfirm, onCancel }: ConfirmDialogProps) {
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
				onCancel();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onCancel]);

	if (!isMounted || !isHydrated) {
		return null;
	}

	const dialogElement = (
		<div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Close"
				onClick={onCancel}
				className={classNames("absolute inset-0 bg-[var(--color-ink-900)]/40", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
			/>
			{/* Concentric: inner buttons --radius-md (8) + p-4/p-5 (16/20)
          → outer 24/28 ≈ --radius-2xl (24). */}
			<div
				className={classNames(
					"relative w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)] md:p-5",
					isClosing ? "animate-dialog-out" : "animate-dialog-in",
				)}
			>
				<div className="flex items-start gap-2.5 md:gap-3">
					{tone === "danger" && (
						<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-danger-50)] text-[var(--color-danger-700)] md:size-9">
							<AlertTriangle size={16} />
						</span>
					)}
					<div className="flex-1">
						<h2 className="text-[14px] font-semibold leading-snug text-[var(--color-ink-900)] md:text-[15px]">{title}</h2>
						<div className="mt-1 text-[13px] text-[var(--color-ink-600)] md:text-sm">{message}</div>
					</div>
				</div>
				<div className="mt-4 flex items-center justify-end gap-2 md:mt-5">
					<Button variant="outline" size="md" onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button variant={tone === "danger" ? "danger" : "primary"} size="md" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);

	return createPortal(dialogElement, document.body);
}
