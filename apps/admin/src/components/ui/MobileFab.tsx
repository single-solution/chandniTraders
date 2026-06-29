"use client";

import type { LucideIcon } from "lucide-react";

interface MobileFabProps {
	/** Spoken label (also rendered visually next to the icon). */
	label: string;
	icon: LucideIcon;
	onClick: () => void;
	disabled?: boolean;
}

/** Mobile-only floating action button anchored to the bottom-right above
 *  the iOS safe area. Hidden on `md+` because the action lives in the
 *  workspace pane header on desktop. Pair with `admin-mobile-pad` on the
 *  scroll container so the last list row clears the FAB. */
export function MobileFab({ label, icon: Icon, onClick, disabled }: MobileFabProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-[var(--color-accent-500)] pl-4 pr-5 text-[0.875rem] font-semibold text-[var(--color-ink-900)] shadow-[var(--shadow-lg)] transition-colors hover:bg-[var(--color-accent-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-700)] active:scale-[0.97] disabled:opacity-50 md:hidden"
		>
			<Icon size={18} strokeWidth={2.4} />
			<span>{label}</span>
		</button>
	);
}
