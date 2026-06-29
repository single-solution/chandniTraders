import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Oswald } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { AppShell } from "@/components/layout/AppShell";
import { MarketingPixels, MarketingPixelsNoScript } from "@/app/_components/marketing/MarketingPixels";
import { SiteJsonLd } from "@/app/_components/seo/SiteJsonLd";
import { getStorefrontBaseUrl } from "@/lib/core/baseUrl";
import { getAttributesCached, getCategoriesCached, getIntegrationSettingsCached, getStoreSettingsCached } from "@/lib/core/cached";
import { getChatSettings } from "@/lib/chat/chatSettings";
import { ChatSettingsProvider } from "@/lib/chat/chatSettingsContext";
import { isOnlineCardCheckoutReady, toClientChatSettings } from "@store/shared";
import { getSeoSettings } from "@/lib/seo/seoSettings";
import { getGoogleSiteVerification } from "@/lib/seo/googleVerification";
import { StoreSettingsProvider } from "@/lib/core/storeSettingsContext";
import { ReferenceProvider, type CategoryReference, type ReferenceData } from "@/lib/core/storefrontReferenceContext";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
	subsets: ["latin"],
	variable: "--font-bricolage",
	display: "swap",
	axes: ["opsz"],
});

const oswald = Oswald({
	subsets: ["latin"],
	variable: "--font-oswald",
	display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
	const [{ siteName, siteTagline, brandFaviconLight, brandFaviconDark }, seoSettings, googleVerification, storefrontBaseUrl] = await Promise.all([
		getStoreSettingsCached(),
		getSeoSettings(),
		getGoogleSiteVerification(),
		getStorefrontBaseUrl(),
	]);
	const defaultOg = seoSettings.defaultOgImageUrl || undefined;

	/* Build the favicon descriptor list dynamically so the browser
     gets the admin-uploaded mark when present and falls back to the
     bundled `/favicon.ico` when neither variant is set. When both
     variants exist, the `media` queries let the browser pick the
     right one for the user's system theme; if only one is set we
     publish it without a media query so it applies everywhere. */
	const faviconLight = brandFaviconLight.trim();
	const faviconDark = brandFaviconDark.trim();
	const iconDescriptors: Array<{ url: string; media?: string }> = [];
	if (faviconLight && faviconDark) {
		iconDescriptors.push({ url: faviconLight, media: "(prefers-color-scheme: light)" });
		iconDescriptors.push({ url: faviconDark, media: "(prefers-color-scheme: dark)" });
	} else if (faviconLight) {
		iconDescriptors.push({ url: faviconLight });
	} else if (faviconDark) {
		iconDescriptors.push({ url: faviconDark });
	} else {
		iconDescriptors.push({ url: "/favicon.ico" });
	}
	return {
		metadataBase: new URL(storefrontBaseUrl),
		title: {
			default: `${siteName} — ${siteTagline}`,
			template: `%s · ${siteName}`,
		},
		description: siteTagline,
		applicationName: siteName,
		alternates: {
			canonical: "/",
		},
		openGraph: {
			type: "website",
			siteName: siteName,
			title: `${siteName} — ${siteTagline}`,
			description: siteTagline,
			url: storefrontBaseUrl,
			locale: "en_PK",
			images: defaultOg ? [defaultOg] : undefined,
		},
		twitter: {
			card: "summary_large_image",
			title: `${siteName} — ${siteTagline}`,
			description: siteTagline,
			images: defaultOg ? [defaultOg] : undefined,
		},
		robots: {
			index: true,
			follow: true,
		},
		icons: {
			icon: iconDescriptors,
		},
		formatDetection: {
			telephone: false,
		},
		verification: googleVerification ? { google: googleVerification } : undefined,
	};
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	/* Mirrors `--color-canvas` — the browser chrome tints to match the
     storefront's light surface. */
	themeColor: "#f8fbf8",
};

interface RootLayoutProps {
	children: React.ReactNode;
}

async function loadStorefrontReference(): Promise<ReferenceData> {
	// Both reads are short, fully cached, and tag-revalidated by admin
	// mutations. Fetch in parallel — they're independent.
	try {
		const [attributes, rawCategories] = await Promise.all([getAttributesCached(), getCategoriesCached()]);
		const categories: CategoryReference[] = rawCategories.map((category) => ({
			slug: category.slug,
			label: category.label,
			description: category.description,
			icon: category.icon,
			iconNode: category.iconNode,
			isActive: category.isActive,
			sortOrder: category.sortOrder,
		}));
		return { attributes, categories };
	} catch {
		return { attributes: [], categories: [] };
	}
}

export default async function RootLayout({ children }: RootLayoutProps) {
	const [settings, reference, chatSettings, integration] = await Promise.all([
		getStoreSettingsCached(),
		loadStorefrontReference(),
		getChatSettings(),
		getIntegrationSettingsCached(),
	]);
	const storefrontSettings = {
		...settings,
		cardCheckoutReady: isOnlineCardCheckoutReady(integration),
	};
	const catalogHomeHref = "/";
	return (
		<html
			lang="en"
			className={`${bricolageGrotesque.variable} ${oswald.variable} no-js`}
			// Tells Next.js the smooth scroll on <html> is intentional and that
			// it should *disable* it temporarily during route transitions
			// (otherwise jumping to a new page does a multi-second scroll
			// animation back to the top). Required by Next 16+ to silence the
			// "missing-data-scroll-behavior" warning.
			data-scroll-behavior="smooth"
			// `no-js` is stripped by `RevealRoot` once it mounts — not by the
			// old inline `<script>` that ran before the animation driver was
			// ready. That race was leaving `.reveal` elements invisible on
			// slow networks between the strip and hydration. Suppress here
			// because the className will diverge after hydration as planned.
			suppressHydrationWarning
		>
			<head>
				{/* Preconnect to the image hosts the LCP candidate will fetch
           from. Saves ~100–250 ms on a cold visit by parallelising the
           TLS/DNS handshake with HTML parsing. Kept tight: only hosts
           that actually serve product imagery. */}
				<link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
				<link rel="preconnect" href="https://cdn.simpleicons.org" crossOrigin="anonymous" />
				{/* Speculation Rules — Chrome/Edge will prefetch same-origin
           links once a pointer/touch lands on them. We use `prefetch`
           (not `prerender`): prerender activated a fully-built page for
           a frame on click, which flashed real content before the
           route's own Suspense skeletons settled. Prefetch warms the
           document without rendering it, so navigation stays fast and
           the page commits skeleton-first like a fresh load.
           `conservative` eagerness means no fetch until the user is
           clearly about to click, so wasted bandwidth on visits that
           never happen is minimal. Excludes admin, account, checkout,
           sign-in (auth / dynamic-by-session) and API routes
           (non-navigational). Other browsers silently ignore the tag.
           Network Information API is respected by Chrome itself: Data
           Saver / 2g connections skip the prefetch automatically. */}
				<script
					type="speculationrules"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							prefetch: [
								{
									source: "document",
									where: {
										and: [
											{ href_matches: "/*" },
											{
												not: {
													href_matches: ["/admin/*", "/account/*", "/checkout/*", "/api/*", "/sign-in*"],
												},
											},
										],
									},
									eagerness: "conservative",
								},
							],
						}),
					}}
				/>
				<MarketingPixels
					metaPixelId={settings.metaPixelId}
					googleAnalyticsId={settings.googleAnalyticsId}
					googleTagManagerId={settings.googleTagManagerId}
					tiktokPixelId={settings.tiktokPixelId}
				/>
			</head>
			<body
				// Browser extensions (Grammarly, ColorZilla, password managers,
				// etc.) inject `data-*` attributes onto <body> before React
				// hydrates. Those attributes are out of our control and React
				// can't safely diff them, so we suppress the warning here. This
				// does NOT suppress mismatches in our own components.
				suppressHydrationWarning
			>
				<SiteJsonLd />
				<MarketingPixelsNoScript googleTagManagerId={settings.googleTagManagerId} />
				<StoreSettingsProvider value={storefrontSettings}>
					<ChatSettingsProvider value={toClientChatSettings(chatSettings)}>
						<ReferenceProvider value={reference}>
							<AppShell footer={<Footer settings={settings} catalogHomeHref={catalogHomeHref} />}>{children}</AppShell>
						</ReferenceProvider>
					</ChatSettingsProvider>
				</StoreSettingsProvider>
			</body>
		</html>
	);
}
