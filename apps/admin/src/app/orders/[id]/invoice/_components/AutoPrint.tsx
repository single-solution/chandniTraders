"use client";

import { useEffect } from "react";

const PRINT_DELAY_MS = 500;

export function AutoPrint() {
	useEffect(() => {
		// Ensure styles and fonts are loaded before triggering print
		const timeout = setTimeout(() => {
			window.print();
		}, PRINT_DELAY_MS);
		return () => clearTimeout(timeout);
	}, []);

	return null;
}
