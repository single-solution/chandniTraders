import { MessageCircle } from "lucide-react";

import { buildWhatsAppLink, isValidWhatsappNumber, normalizeWhatsappNumber, type StoreSettings } from "@store/shared";

import { BrandLockup } from "@/components/layout/BrandLockup";
import { FacebookIcon, InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/ui/SocialIcons";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";

interface FooterProps {
	settings: StoreSettings;
	catalogHomeHref: string;
}

/**
 * Server-rendered site footer. Receives `settings` as a prop (rather than
 * reading `useStoreSettings()`) so it can render on the server and stay out
 * of the client bundle — it is injected as a slot by the client chrome.
 */
export function Footer({ settings, catalogHomeHref }: FooterProps) {
	const socialButtons = [
		{ href: settings.socialFacebook, label: "Facebook", icon: <FacebookIcon size={15} /> },
		{ href: settings.socialInstagram, label: "Instagram", icon: <InstagramIcon size={15} /> },
		{ href: settings.socialTiktok, label: "TikTok", icon: <TiktokIcon size={15} /> },
		{ href: settings.socialYoutube, label: "YouTube", icon: <YoutubeIcon size={15} /> },
	].filter((btn) => Boolean(btn.href && btn.href.trim()));

	const whatsappDigits = normalizeWhatsappNumber(settings.whatsappNumber);
	const showWhatsAppButton = isValidWhatsappNumber(whatsappDigits);

	return (
		<footer className="cv-auto mt-14 border-t border-[var(--color-ink-100)] bg-[var(--color-ink-900)] text-[var(--color-ink-200)] sm:mt-24">
			<div className={`${STOREFRONT_SHELL_CLASS} py-8 sm:py-10`}>
				<div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
						<BrandLockup
							href={catalogHomeHref}
							siteName={settings.siteName}
							/* Prefer the dark-surface logo down here since the footer
                 sits on `--color-ink-900`; fall back to the light logo
                 so a single uploaded mark still works. Empty string ⇒
                 wordmark only. */
							logoUrl={settings.brandLogoDark || settings.brandLogoLight}
							tone="dark"
							size="md"
						/>
						<span className="hidden h-6 w-px bg-[var(--color-ink-700)] sm:block" />
						<p className="max-w-xs text-sm text-[var(--color-ink-400)]">{settings.siteTagline}</p>
					</div>

					<div className="flex flex-wrap items-center justify-center gap-3">
						{showWhatsAppButton ? (
							<a
								href={buildWhatsAppLink("Salam!", whatsappDigits)}
								target="_blank"
								rel="noopener noreferrer"
								className="tap focus-ring inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-whatsapp)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-whatsapp-dark)]"
							>
								<MessageCircle size={15} className="fill-[var(--color-on-dark)]" />
								Chat on WhatsApp
							</a>
						) : null}
						<div className="flex items-center gap-1.5">
							{socialButtons.map((socialButton) => (
								<a
									key={socialButton.label}
									href={socialButton.href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={socialButton.label}
									className="tap focus-ring grid size-9 place-items-center rounded-[var(--radius-md)] border border-[var(--color-ink-700)] bg-[var(--color-ink-800)] text-[var(--color-ink-300)] transition-colors hover:border-[var(--color-accent-500)] hover:bg-[var(--color-accent-500)] hover:text-[var(--color-ink-900)]"
								>
									{socialButton.icon}
								</a>
							))}
						</div>
					</div>
				</div>

				<div className="mt-7 flex flex-col gap-3 border-t border-[var(--color-ink-700)] pt-5 text-center text-[11px] text-[var(--color-ink-400)] sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:text-left">
					<span>
						© {new Date().getFullYear()} {settings.siteName}. All rights reserved.
					</span>
					<span className="flex items-center justify-center gap-1.5 sm:justify-end">
						Developed by{" "}
						<a
							href="https://github.com/single-solution"
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-[var(--color-ink-300)] transition-colors hover:text-[var(--color-accent-400)]"
						>
							Single-solution
						</a>
					</span>
				</div>
			</div>
		</footer>
	);
}
