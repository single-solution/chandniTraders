const INTERNAL_MESSAGE_PATTERNS = [
	/\n\s+at\s/m,
	/node_modules/i,
	/\.tsx:\d+/i,
	/\.ts:\d+/i,
	/\.js:\d+/i,
	/mongodb/i,
	/mongoose/i,
	/prisma/i,
	/econnrefused/i,
	/server components render/i,
	/omitted in production/i,
	/webpack/i,
	/\/Users\//,
	/\/home\//,
	/\\Users\\/,
	/objectid/i,
	/\[object object\]/i,
];

const NETWORK_MESSAGE_HINTS = [
	"failed to fetch",
	"network error",
	"network request failed",
	"load failed",
	"fetch failed",
	"err_internet_disconnected",
	"err_network_changed",
	"net::err",
];

export interface PublicErrorDisplay {
	eyebrow: string;
	title: string;
	detail: string;
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message?.trim() ?? "";
	}
	if (typeof error === "string") {
		return error.trim();
	}
	return "";
}

function isOffline(): boolean {
	return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isNetworkFailure(error: unknown, message: string): boolean {
	if (isOffline()) {
		return true;
	}

	const normalized = message.toLowerCase();
	if (NETWORK_MESSAGE_HINTS.some((hint) => normalized.includes(hint))) {
		return true;
	}

	return error instanceof TypeError && normalized.includes("fetch");
}

function isTimeoutFailure(error: unknown, message: string): boolean {
	const normalized = message.toLowerCase();
	if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("etimedout")) {
		return true;
	}

	return error instanceof DOMException && error.name === "AbortError" && normalized.includes("timeout");
}

function isSafePublicMessage(message: string): boolean {
	if (!message || message.length < 4 || message.length > 280) {
		return false;
	}

	if (message.includes("\n")) {
		return false;
	}

	if (INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
		return false;
	}

	if (!/[a-zA-Z]/.test(message)) {
		return false;
	}

	if (message.startsWith("{") || message.startsWith("[")) {
		return false;
	}

	return true;
}

/** Maps thrown values to customer-safe copy for full-page error boundaries. */
export function resolvePublicErrorDisplay(error: unknown): PublicErrorDisplay {
	const message = extractErrorMessage(error);

	if (isOffline()) {
		return {
			eyebrow: "Connection problem",
			title: "You're offline",
			detail: "Reconnect to the internet, then try again.",
		};
	}

	if (isNetworkFailure(error, message)) {
		return {
			eyebrow: "Connection problem",
			title: "Network error",
			detail: "We couldn't reach our servers. Check your connection and try again.",
		};
	}

	if (isTimeoutFailure(error, message)) {
		return {
			eyebrow: "Connection problem",
			title: "Request timed out",
			detail: "The server took too long to respond. Please try again.",
		};
	}

	if (isSafePublicMessage(message)) {
		return {
			eyebrow: "Something went wrong",
			title: message,
			detail: "If this keeps happening, message us on WhatsApp and we'll get you sorted.",
		};
	}

	return {
		eyebrow: "Something went wrong",
		title: "The page couldn't finish loading",
		detail: "Please try again — if it keeps happening, message us on WhatsApp and we'll get you sorted.",
	};
}

/** Single-line message for inline form and widget errors. */
export function resolvePublicErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
	const message = extractErrorMessage(error);

	if (isOffline()) {
		return "You're offline. Reconnect and try again.";
	}

	if (isNetworkFailure(error, message)) {
		return "Network error — couldn't reach our servers. Please try again.";
	}

	if (isTimeoutFailure(error, message)) {
		return "Request timed out. Please try again.";
	}

	if (isSafePublicMessage(message)) {
		return message;
	}

	return fallback;
}
