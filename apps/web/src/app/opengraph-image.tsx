/**
 * Home OG card.
 *
 * Branded 1200×630 image used whenever someone shares the storefront
 * root. Simple — store name, tagline, and (if available) the default
 * OG image from settings.
 *
 * Every hex literal mirrors the official palette so the OG card stays
 * in-brand without depending on runtime CSS variables (Vercel OG runs
 * in an isolated edge runtime that can't read globals.css).
 *   #00272c -> --color-ink-900
 *   #0a3035 -> --color-ink-800
 *   #1a3f44 -> --color-ink-700
 *   #f8fbf8 -> --color-canvas
 */

import { ImageResponse } from "next/og";

import { getStoreSettingsCached } from "@/lib/core/cached";
import { getSeoSettings } from "@/lib/seo/seoSettings";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const revalidate = 86_400;
export const alt = "Chandni Traders";

interface HomeOgData {
	siteName: string;
	siteTagline: string;
	storeAddressLine1: string;
	storeAddressLine2: string;
	defaultOgImageUrl: string;
}

async function loadHomeOgData(): Promise<HomeOgData | null> {
	try {
		const [settings, seoSettings] = await Promise.all([getStoreSettingsCached(), getSeoSettings()]);
		return {
			siteName: settings.siteName,
			siteTagline: settings.siteTagline,
			storeAddressLine1: settings.storeAddressLine1,
			storeAddressLine2: settings.storeAddressLine2,
			defaultOgImageUrl: seoSettings.defaultOgImageUrl,
		};
	} catch {
		return null;
	}
}

export default async function HomeOgImage() {
	const data = await loadHomeOgData();
	if (!data) {
		return fallbackImage();
	}
	return new ImageResponse(<HomeCard {...data} />, size);
}

function HomeCard(data: HomeOgData) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				background: "linear-gradient(135deg, #1a3f44 0%, #0a3035 60%, #00272c 100%)",
				color: "#f8fbf8",
				fontFamily: "system-ui, sans-serif",
				padding: 80,
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 20,
					maxWidth: 700,
				}}
			>
				<div
					style={{
						display: "flex",
						alignSelf: "flex-start",
						background: "rgba(255,255,255,0.15)",
						borderRadius: 9999,
						padding: "8px 22px",
						fontSize: 22,
						letterSpacing: 2,
						textTransform: "uppercase",
					}}
				>
					{data.siteName}
				</div>
				<div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{data.siteTagline}</div>
				<div style={{ display: "flex", fontSize: 24, opacity: 0.85 }}>{`Visit ${data.storeAddressLine1}, ${data.storeAddressLine2}`}</div>
			</div>
			{data.defaultOgImageUrl ? (
				<div
					style={{
						width: 360,
						height: 360,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<img src={data.defaultOgImageUrl} width={340} height={340} alt={data.siteName} style={{ borderRadius: 32, objectFit: "contain" }} />
				</div>
			) : null}
		</div>
	);
}

function fallbackImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#00272c",
				color: "#f8fbf8",
				fontFamily: "system-ui, sans-serif",
				fontSize: 84,
				fontWeight: 800,
			}}
		>
			Chandni Traders
		</div>,
		size,
	);
}
