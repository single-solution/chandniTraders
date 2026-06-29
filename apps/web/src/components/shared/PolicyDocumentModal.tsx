"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames, sanitizePolicyHtml } from "@store/shared";

interface PolicyDocumentModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	html: string;
}

export function PolicyDocumentModal({ isOpen, onClose, title, html }: PolicyDocumentModalProps) {
	const [isHydrated] = useState(() => typeof document !== "undefined");
	const safeHtml = sanitizePolicyHtml(html);

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

	if (!isOpen || !isHydrated) {
		return null;
	}

	const dialogElement = (
		<div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
			<button type="button" aria-label="Close policy" onClick={onClose} className="absolute inset-0 bg-[var(--color-ink-900)]/40 animate-sheet-fade" />
			<div className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-dialog-in">
				<div className="flex shrink-0 items-center justify-between border-b border-[var(--color-ink-100)] px-4 py-3 md:px-5">
					<h2 className="text-[15px] font-semibold text-[var(--color-ink-900)] md:text-base">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						className="tap rounded-full p-1.5 text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]"
					>
						<X size={18} />
					</button>
				</div>
				<div
					className={classNames(
						"policy-document flex-1 overflow-y-auto px-4 py-4 text-[13px] leading-relaxed text-[var(--color-ink-700)] md:px-5 md:py-5 md:text-[14px]",
						"[&_a]:text-[var(--color-accent-700)] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--color-ink-900)] [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
					)}
				>
					{safeHtml ? (
						<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
					) : (
						<p className="text-[var(--color-ink-500)]">This policy has not been published yet. Contact the store for details.</p>
					)}
				</div>
			</div>
		</div>
	);

	return createPortal(dialogElement, document.body);
}
