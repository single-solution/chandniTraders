"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { isProductDetailPath } from "@/lib/catalog/productPaths";

interface ShopBannerPersistProps {
	children: ReactNode;
}

/** Hides the shop intro on PDP; otherwise renders the live Suspense boundary. */
export function ShopBannerPersist({ children }: ShopBannerPersistProps) {
	const pathname = usePathname() ?? "";

	if (isProductDetailPath(pathname)) {
		return null;
	}

	return <>{children}</>;
}
