"use client";

import { MapPin } from "lucide-react";
import type { StoreSettings } from "@store/shared";
import { useGlobalEagerLoad } from "@/lib/useGlobalEagerLoad";

// Copied from homePageDesktopSections
const MAP_EMBED_ZOOM = 17;

export interface StoreMapEmbedProps {
	className?: string;
	settings: StoreSettings;
}

export function StoreMapEmbed({ className = "", settings }: StoreMapEmbedProps) {
	const globalEager = useGlobalEagerLoad();
	const mapQuery = `${settings.storeAddressLine1}, ${settings.storeAddressLine2}`;
	const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${MAP_EMBED_ZOOM}&output=embed`;

	return (
		<div className={`relative w-full overflow-hidden bg-[var(--color-canvas-deep)] ${className}`}>
			<iframe
				title={`Map of ${mapQuery}`}
				src={mapEmbedUrl}
				loading={globalEager ? "eager" : "lazy"}
				referrerPolicy="no-referrer-when-downgrade"
				allowFullScreen
				className="absolute inset-0 h-full w-full border-0"
			/>
			<a
				href={settings.socialGoogleMaps}
				target="_blank"
				rel="noopener noreferrer"
				className="tap absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)]/95 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-900)] shadow-[var(--shadow-md)] backdrop-blur hover:bg-[var(--color-surface)]"
			>
				<MapPin size={12} className="text-[var(--color-accent-700)]" />
				Open in Maps
			</a>
		</div>
	);
}
