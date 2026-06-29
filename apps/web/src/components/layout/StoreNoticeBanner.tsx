"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";

export function StoreNoticeBanner() {
	const { storeNoticeEnabled, storeNoticeText } = useStoreSettings();
	const [isDismissed, setIsDismissed] = useState(false);

	if (!storeNoticeEnabled || !storeNoticeText || isDismissed) {
		return null;
	}

	return (
		<div className="relative bg-[var(--color-accent-600)] px-4 py-2.5 pr-10 text-center text-[13px] font-medium text-white sm:text-sm">
			<p className="mx-auto max-w-4xl">{storeNoticeText}</p>
			<button
				type="button"
				onClick={() => setIsDismissed(true)}
				className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
				aria-label="Dismiss notice"
			>
				<X size={16} />
			</button>
		</div>
	);
}
