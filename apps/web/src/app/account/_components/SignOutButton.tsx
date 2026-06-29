"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { setSignedIn } from "@/lib/auth/useIsSignedIn";
import { clearCart } from "@/lib/cart/store";

export function SignOutButton() {
	const [isSigningOut, setIsSigningOut] = useState(false);

	return (
		<button
			type="button"
			disabled={isSigningOut}
			onClick={() => {
				setIsSigningOut(true);
				// Clear client-only state on this device before the server clears the
				// session + chat cookies (so a shared device leaks nothing to the next
				// visitor and the header flips to "Sign in" immediately).
				clearCart();
				setSignedIn(false);
				window.location.href = "/account/sign-out?to=/";
			}}
			className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-3 text-[12.5px] font-semibold text-[var(--color-ink-700)] hover:border-[var(--color-ink-300)] disabled:opacity-50 disabled:cursor-not-allowed"
			aria-label="Sign out"
		>
			{isSigningOut ? <span className="block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <LogOut size={13} />}
			{isSigningOut ? "Signing out…" : "Sign out"}
		</button>
	);
}
