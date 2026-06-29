"use client";

/**
 * Lightweight, dependency-free toast host.
 *
 * - One portal-rendered, bottom-anchored stack with a polite `aria-live`
 *   region so screen readers announce confirmations (add-to-cart, line
 *   removals) without stealing focus.
 * - Pure-CSS enter/exit (see `.animate-toast-*` in globals.css); each toast
 *   stays mounted through its exit animation, mirroring `usePresence`.
 *
 * Consume via `useToast()` anywhere inside `<ToastProvider>`.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Info, X } from "lucide-react";
import { classNames } from "@store/shared";

type ToastTone = "success" | "info";

interface ToastOptions {
	tone?: ToastTone;
	/** Auto-dismiss delay; set 0 to require manual dismiss. */
	durationMs?: number;
}

interface ToastRecord {
	id: number;
	message: string;
	tone: ToastTone;
	leaving: boolean;
}

interface ToastContextValue {
	toast: (message: string, options?: ToastOptions) => void;
}

const DEFAULT_DURATION_MS = 3200;
/** Matches `.animate-toast-out` duration in globals.css. */
const TOAST_EXIT_MS = 180;
/** Cap the stack so a burst of events can't tower up the screen. */
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastRecord[]>([]);
	const [isHydrated, setIsHydrated] = useState(false);
	const nextIdRef = useRef(1);
	const timersRef = useRef<Map<number, number>>(new Map());

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration detection for the portal
		setIsHydrated(true);
		const timers = timersRef.current;
		return () => {
			for (const handle of timers.values()) {
				window.clearTimeout(handle);
			}
			timers.clear();
		};
	}, []);

	const remove = useCallback((id: number) => {
		setToasts((current) => current.filter((item) => item.id !== id));
	}, []);

	const dismiss = useCallback(
		(id: number) => {
			setToasts((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
			const handle = window.setTimeout(() => remove(id), TOAST_EXIT_MS);
			timersRef.current.set(id, handle);
		},
		[remove],
	);

	const toast = useCallback(
		(message: string, options?: ToastOptions) => {
			const id = nextIdRef.current;
			nextIdRef.current += 1;
			const tone = options?.tone ?? "success";
			const duration = options?.durationMs ?? DEFAULT_DURATION_MS;

			setToasts((current) => {
				const next = [...current, { id, message, tone, leaving: false }];
				return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
			});

			if (duration > 0) {
				const handle = window.setTimeout(() => dismiss(id), duration);
				timersRef.current.set(id, handle);
			}
		},
		[dismiss],
	);

	return (
		<ToastContext.Provider value={{ toast }}>
			{children}
			{isHydrated ? createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body) : null}
		</ToastContext.Provider>
	);
}

interface ToastViewportProps {
	toasts: ToastRecord[];
	onDismiss: (id: number) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
	return (
		<div
			aria-live="polite"
			aria-atomic="false"
			className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]"
		>
			{toasts.map((item) => (
				<div
					key={item.id}
					role="status"
					className={classNames(
						"pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-[var(--radius-full)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] py-2.5 pl-3.5 pr-2.5 shadow-[var(--shadow-lg)]",
						item.leaving ? "animate-toast-out" : "animate-toast-in",
					)}
				>
					<span
						className={classNames(
							"grid size-6 shrink-0 place-items-center rounded-full",
							item.tone === "success" ? "bg-[var(--color-accent-50)] text-[var(--color-accent-700)]" : "bg-[var(--color-canvas-deep)] text-[var(--color-ink-600)]",
						)}
					>
						{item.tone === "success" ? <Check size={14} strokeWidth={2.6} /> : <Info size={14} />}
					</span>
					<p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink-900)]">{item.message}</p>
					<button
						type="button"
						aria-label="Dismiss"
						onClick={() => onDismiss(item.id)}
						className="tap focus-ring grid size-7 shrink-0 place-items-center rounded-full text-[var(--color-ink-400)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-700)]"
					>
						<X size={14} />
					</button>
				</div>
			))}
		</div>
	);
}

export function useToast(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within <ToastProvider>");
	}
	return context;
}
