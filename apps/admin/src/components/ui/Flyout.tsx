"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames } from "@store/shared";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";

interface FlyoutProps {
	isOpen: boolean;
	onClose: () => void;
	side?: "right" | "left";
	title?: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	width?: "sm" | "md" | "lg";
	showCloseButton?: boolean;
	contentClassName?: string;
}

const WIDTH_CLASSES: Record<NonNullable<FlyoutProps["width"]>, string> = {
	sm: "w-[80vw] max-w-[300px]",
	md: "w-[86vw] max-w-[360px]",
	lg: "w-[92vw] max-w-[420px]",
};

export function Flyout({ isOpen, onClose, side = "right", title, description, children, footer, width = "md", showCloseButton = true, contentClassName }: FlyoutProps) {
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

	const isRight = side === "right";

	const flyoutElement = (
		<div className="fixed inset-0 z-[var(--z-modal)] flex md:hidden">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className={classNames("absolute inset-0 bg-[var(--color-ink-900)]/40", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
			/>

			{!isRight && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label={title}
					className={classNames(
						"relative flex h-[100dvh] flex-col overflow-hidden bg-[var(--color-canvas)] shadow-[var(--shadow-lg)] safe-top",
						isClosing ? "animate-flyout-out-left" : "animate-flyout-left",
						WIDTH_CLASSES[width],
					)}
				>
					<FlyoutInner title={title} description={description} onClose={onClose} showCloseButton={showCloseButton} footer={footer} contentClassName={contentClassName}>
						{children}
					</FlyoutInner>
				</div>
			)}

			{isRight && (
				<>
					<div className="flex-1" />
					<div
						role="dialog"
						aria-modal="true"
						aria-label={title}
						className={classNames(
							"relative flex h-[100dvh] flex-col overflow-hidden bg-[var(--color-canvas)] shadow-[var(--shadow-lg)] safe-top",
							isClosing ? "animate-flyout-out-right" : "animate-flyout-right",
							WIDTH_CLASSES[width],
						)}
					>
						<FlyoutInner title={title} description={description} onClose={onClose} showCloseButton={showCloseButton} footer={footer} contentClassName={contentClassName}>
							{children}
						</FlyoutInner>
					</div>
				</>
			)}
		</div>
	);

	return createPortal(flyoutElement, document.body);
}

interface FlyoutInnerProps {
	title?: string;
	description?: string;
	onClose: () => void;
	showCloseButton: boolean;
	footer?: React.ReactNode;
	contentClassName?: string;
	children: React.ReactNode;
}

function FlyoutInner({ title, description, onClose, showCloseButton, footer, contentClassName, children }: FlyoutInnerProps) {
	return (
		<>
			{Boolean(title || showCloseButton) && (
				<div className="flex items-start gap-2 border-b border-[var(--color-ink-100)] px-4 py-2.5">
					{Boolean(title) && (
						<div className="min-w-0 flex-1">
							<h2 className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--color-ink-900)]">{title}</h2>
							{Boolean(description) && <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-ink-500)]">{description}</p>}
						</div>
					)}
					{showCloseButton && (
						<button
							type="button"
							aria-label="Close"
							onClick={onClose}
							className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-ink-600)] active:bg-[var(--color-surface-muted)]"
						>
							<X size={18} />
						</button>
					)}
				</div>
			)}

			<div className={classNames("flex-1 overflow-y-auto overscroll-contain px-4 py-4", contentClassName)}>{children}</div>

			{Boolean(footer) && (
				<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-4 pt-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}>
					{footer}
				</div>
			)}
		</>
	);
}
