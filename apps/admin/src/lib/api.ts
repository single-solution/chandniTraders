/**
 * Tiny fetch wrapper used by every admin client component. Centralises:
 *   - JSON encoding / decoding
 *   - Error → Error object normalisation (so callers can do `try/catch`)
 *   - 204 No Content support
 *
 * Routes that 401 redirect to the login page so a stale session can be
 * refreshed without manual intervention.
 */
export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

interface AdminFetchOptions extends RequestInit {
	/** Send `body` as JSON (omit `Content-Type` and stringify automatically). */
	json?: unknown;
}

export async function apiFetch<TResponse>(url: string, options: AdminFetchOptions = {}): Promise<TResponse> {
	const { json, headers, body, ...rest } = options;
	const isJsonBody = json !== undefined;

	const response = await fetch(url, {
		...rest,
		headers: {
			...(isJsonBody ? { "Content-Type": "application/json" } : {}),
			...(headers ?? {}),
		},
		body: isJsonBody ? JSON.stringify(json) : body,
	});

	if (response.status === 401 && typeof window !== "undefined") {
		const callbackUrl = encodeURIComponent(window.location.pathname);
		window.location.href = `/login?callbackUrl=${callbackUrl}`;
		throw new ApiError("Session expired. Redirecting…", 401);
	}

	if (response.status === 204 || response.status === 304) {
		return undefined as TResponse;
	}

	const text = await response.text();
	const payload = text ? safeParseJson(text) : null;

	if (!response.ok) {
		const message =
			(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : null) ?? `Request failed (${response.status})`;
		throw new ApiError(message, response.status);
	}

	// The server's response shape is opaque to this fetch wrapper; trust the
	// caller's `<TResponse>` and let the call site do narrowing if it needs to.
	return payload as TResponse;
}

function safeParseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
