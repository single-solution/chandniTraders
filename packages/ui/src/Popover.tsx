"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { classNames, computeFloatingPosition, type FloatingAlign } from "@store/shared";

export interface PopoverProps {
	isOpen: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	children: ReactNode;
	className?: string;
	role?: string;
	"aria-label"?: string;
	align?: FloatingAlign;
	/** Closes on outside mousedown and Escape — pass when the popover has interactive content. */
	onRequestClose?: () => void;
}

/**
 * Portaled popover anchored to a trigger — flips and clamps within the viewport.
 */
export function Popover({ isOpen, anchorRef, children, className, role, "aria-label": ariaLabel, align = "right", onRequestClose }: PopoverProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

	const updatePosition = useCallback(() => {
		if (!anchorRef.current || !panelRef.current) {
			return;
		}

		const anchorRect = anchorRef.current.getBoundingClientRect();
		const panelRect = panelRef.current.getBoundingClientRect();
		const position = computeFloatingPosition({
			anchorRect,
			panelWidth: panelRect.width,
			panelHeight: panelRect.height,
			align,
		});

		setPanelStyle({
			position: "fixed",
			top: position.top,
			bottom: position.bottom,
			left: position.left,
			right: position.right,
			maxHeight: position.maxHeight,
			maxWidth: position.maxWidth,
			overflowY: position.maxHeight ? "auto" : undefined,
			visibility: "visible",
		});
	}, [align, anchorRef]);

	useLayoutEffect(() => {
		if (!isOpen) {
			setPanelStyle(null);
			return;
		}

		updatePosition();

		const panelElement = panelRef.current;
		const resizeObserver = panelElement ? new ResizeObserver(updatePosition) : null;
		if (panelElement && resizeObserver) {
			resizeObserver.observe(panelElement);
		}

		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [isOpen, updatePosition]);

	useEffect(() => {
		if (!isOpen || !onRequestClose) {
			return;
		}

		const requestClose = onRequestClose;

		function handlePointerDown(event: MouseEvent) {
			const target = event.target as Node;
			if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
				return;
			}
			requestClose();
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				requestClose();
			}
		}

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [anchorRef, isOpen, onRequestClose]);

	if (!isOpen || typeof document === "undefined") {
		return null;
	}

	const fallbackStyle: CSSProperties = {
		position: "fixed",
		visibility: "hidden",
		top: 0,
		left: 0,
	};

	return createPortal(
		<div ref={panelRef} role={role} aria-label={ariaLabel} style={panelStyle ?? fallbackStyle} className={classNames("z-[60]", className)}>
			{children}
		</div>,
		document.body,
	);
}
