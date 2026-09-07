"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PhoneOtp } from "@/app/account/_components/PhoneOtp";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

export function SignIn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { siteName, disableCustomerSignIn } = useStoreSettings();
	const { startNavigation } = useNavigationTransition();
	const requestedNext = searchParams?.get("next");
	const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";

	function handleVerified() {
		startNavigation(() => {
			router.push(next);
			router.refresh();
		});
	}

	if (disableCustomerSignIn) {
		const isFromCheckout = next.startsWith("/checkout");
		return (
			<div className={`storefront-page-center ${STOREFRONT_SHELL_CLASS} w-full`}>
				<div className="w-full max-w-md">
					<div className="reveal text-center">
						<span className="inline-grid size-12 place-items-center rounded-2xl bg-[var(--color-accent-100)] text-[var(--color-accent-800)]">
							<ShieldCheck size={20} strokeWidth={2.4} />
						</span>
						<h1 className="mt-4 font-headline text-page-title font-semibold text-[var(--color-ink-900)]">Sign-in temporarily paused</h1>
						<p className="mx-auto mt-2 max-w-prose text-[13px] text-[var(--color-ink-600)] md:text-sm">
							WhatsApp verification is currently being set up. You can browse all products and place orders directly with guest checkout — no sign-in required!
						</p>
					</div>

					<Card className="reveal mt-6 p-5 text-center md:mt-8 md:p-6">
						{isFromCheckout ? (
							<Link
								href="/checkout"
								className="cta-arrow inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[14px] font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-accent-600)]"
							>
								Continue to checkout
								<ArrowUpRight size={16} />
							</Link>
						) : (
							<Link
								href="/"
								className="cta-arrow inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[14px] font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-accent-600)]"
							>
								Browse shop
								<ArrowUpRight size={16} />
							</Link>
						)}
					</Card>
				</div>
			</div>
		);
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
