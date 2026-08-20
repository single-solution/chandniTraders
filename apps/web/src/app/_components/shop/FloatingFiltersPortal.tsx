"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function FloatingFiltersPortal({ children }: { children: React.ReactNode }) {
	const [target, setTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const el = document.getElementById("shop-floating-filters");
		if (el) {
			setTarget(el);
		} else {
			const timer = setTimeout(() => {
				setTarget(document.getElementById("shop-floating-filters"));
			}, 100);
			return () => clearTimeout(timer);
		}
	}, []);

	if (!target) {
		return null;
	}

	return createPortal(children, target);
}
