"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";

export function DashboardAccessBanner() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const toast = useToast();
	const { startNavigation } = useNavigationTransition();

	useEffect(() => {
		if (searchParams.get("access") !== "denied") return;
		toast.warn("You do not have permission to open that page.");
		const params = new URLSearchParams(searchParams.toString());
		params.delete("access");
		const query = params.toString();
		const url = query ? `/?${query}` : "/";
		startNavigation(() => router.replace(url, { scroll: false }));
	}, [router, searchParams, toast, startNavigation]);

	return null;
}
