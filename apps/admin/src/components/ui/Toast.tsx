"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { classNames } from "@store/shared";

type ToastTone = "success" | "info" | "warn" | "danger";

interface ToastEntry {
	id: number;
	message: string;
	tone: ToastTone;
}

interface ToastApi {
	success: (message: string) => void;
	info: (message: string) => void;
	warn: (message: string) => void;
	danger: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
	success: "border-[var(--color-accent-200)] bg-[var(--color-accent-50)] text-[var(--color-accent-800)]",
	info: "border-sky-200 bg-sky-50 text-sky-800",
	warn: "border-amber-200 bg-amber-50 text-amber-800",
	danger: "border-rose-200 bg-rose-50 text-rose-800",
};

const TONE_ICONS: Record<ToastTone, ReactNode> = {
	success: <CheckCircle2 size={16} />,
	info: <Info size={16} />,
	warn: <AlertTriangle size={16} />,
	danger: <XCircle size={16} />,
};

const TOAST_AUTO_DISMISS_MS = 3_500;

interface ToastProviderProps {
	children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
	const [toasts, setToasts] = useState<ToastEntry[]>([]);

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const push = useCallback((message: string, tone: ToastTone) => {
		const id = Date.now() + Math.random();
		setToasts((current) => [...current, { id, message, tone }]);
		/* Auto-dismiss is owned by the ToastItem — it flips into the
       `leaving` state shortly before the deadline so the exit
       keyframe can play, then calls `onDismiss` (which removes the
       entry from the array) when the animation actually ends. */
	}, []);

	const api = useMemo<ToastApi>(
		() => ({
			success: (message) => push(message, "success"),
			info: (message) => push(message, "info"),
			warn: (message) => push(message, "warn"),
			danger: (message) => push(message, "danger"),
		}),
		[push],
	);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div
				aria-live="polite"
				aria-atomic="false"
				className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]"
			>
				{toasts.map((toast) => (
					<ToastItem key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => dismiss(toast.id)} />
				))}
			</div>
		</ToastContext.Provider>
	);
}

interface ToastItemProps {
	message: string;
	tone: ToastTone;
	onDismiss: () => void;
}

/* Toast lifecycle is fully CSS-driven via the `data-toast-state`
   attribute (see `toast-in` / `toast-out` keyframes in globals.css).
   The component just flips the attribute on enter / leave and waits
   for the `animationend` event to unmount — no transition coordination
   in JS, no animation library, lightweight by design. */
const TOAST_EXIT_LEAD_MS = 180;

function ToastItem({ message, tone, onDismiss }: ToastItemProps) {
	const [state, setState] = useState<"entering" | "leaving">("entering");

	useEffect(() => {
		/* Start the leave animation slightly before the auto-dismiss
       deadline so the exit keyframe has time to play. */
		const leaveTimer = window.setTimeout(() => setState("leaving"), TOAST_AUTO_DISMISS_MS - TOAST_EXIT_LEAD_MS);
		return () => window.clearTimeout(leaveTimer);
	}, []);

	const isError = tone === "danger";
	return (
		<div
			role={isError ? "alert" : "status"}
			aria-live={isError ? "assertive" : "polite"}
			data-toast-state={state}
			onAnimationEnd={(event) => {
				/* Only react to the outer wrapper's own animation, not to any
           child animations bubbling up (icons can have their own
           keyframes in the future). */
				if (event.target === event.currentTarget && state === "leaving") {
					onDismiss();
				}
			}}
			className={classNames(
				"pointer-events-auto w-full max-w-sm sm:w-80 flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3 shadow-[var(--shadow-md)] backdrop-blur",
				TONE_CLASSES[tone],
			)}
		>
			<span className="mt-0.5 shrink-0">{TONE_ICONS[tone]}</span>
			<p className="flex-1 text-sm font-medium leading-snug">{message}</p>
			<button
				type="button"
				aria-label="Dismiss"
				onClick={() => setState("leaving")}
				className="-m-1 grid size-6 shrink-0 place-items-center rounded text-current opacity-70 transition-opacity hover:opacity-100"
			>
				<X size={14} />
			</button>
		</div>
	);
}

export function useToast(): ToastApi {
	const api = useContext(ToastContext);
	if (!api) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return api;
}
