"use client";

import { createElement } from "react";
import { icons as lucideIcons } from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { DEFAULT_ICON, normalizeIconName } from "@store/shared";

const lucideIconRegistry = lucideIcons as Record<string, LucideIcon | undefined>;

function getLucideIconComponent(name?: string): LucideIcon {
	const normalized = normalizeIconName(name, DEFAULT_ICON);
	const icon = lucideIconRegistry[normalized];
	if (icon) {
		return icon;
	}
	return lucideIconRegistry.Package ?? lucideIconRegistry.Box!;
}

export function LucideIconRenderer({ name, ...props }: LucideProps & { name?: string }) {
	return createElement(getLucideIconComponent(name), props);
}
