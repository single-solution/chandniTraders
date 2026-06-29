"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PhoneOtp } from "@/app/account/_components/PhoneOtp";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

export function SignIn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { siteName } = useStoreSettings();
	const { startNavigation } = useNavigationTransition();
	const requestedNext = searchParams?.get("next");
	const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";

	function handleVerified() {
		startNavigation(() => {
			router.push(next);
			router.refresh();
		});
	}

	return (
		<div className={`storefront-page-center ${STOREFRONT_SHELL_CLASS} w-full`}>
			<div className="w-full max-w-md">
				<div className="reveal text-center">
					<span className="inline-grid size-12 place-items-center rounded-2xl bg-[var(--color-accent-500)] text-[var(--color-ink-900)]">
						<ShieldCheck size={20} strokeWidth={2.4} />
					</span>
					<h1 className="mt-4 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">Sign in to {siteName}</h1>
					<p className="mx-auto mt-1 max-w-prose text-[13px] text-[var(--color-ink-500)] md:text-sm">We&rsquo;ll send a one-time code to your phone — no password needed.</p>
				</div>

				<Card className="reveal mt-6 p-5 md:mt-8 md:p-6">
					<PhoneOtp phoneSubmitLabel="Send code" codeSubmitLabel="Verify and sign in" onVerified={handleVerified} phonePlaceholder="+92 320 4862403" autoFocusPhone />
				</Card>
			</div>
		</div>
	);
}
