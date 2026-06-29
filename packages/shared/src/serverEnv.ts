/**
 * Boot-time server environment validation.
 *
 * Both Next.js apps wire this into `instrumentation.ts` so a missing or
 * malformed secret crashes the server **at startup** with a precise message,
 * rather than failing lazily mid-request once a customer or admin trips it.
 *
 * Rules:
 *   - Node-only — never imported from `middleware.ts`, `authConfig.ts`, or
 *     anywhere the edge bundler reaches.
 *   - Pure validation: never reads, never side-effects beyond throwing.
 *   - `AUTH_SECRET` minimum entropy is 32 bytes (Auth.js' own recommendation).
 *   - `MONGODB_URI` must look like an actual Mongo connection string so a
 *     stray `localhost:3000` typo blows up before queries fan out.
 */
import { logger } from "./logger";

/** Minimum acceptable byte length of `AUTH_SECRET`. Anything shorter falls
 *  below Auth.js' own JWT key recommendation and is rejected outright. */
const AUTH_SECRET_MIN_BYTES = 32;

/** Required env vars — every app needs all of these to boot. */
const REQUIRED_VARS = ["AUTH_SECRET", "MONGODB_URI"] as const;
type RequiredVar = (typeof REQUIRED_VARS)[number];

export interface AssertServerEnvOptions {
	/** Human-readable app label included in any thrown error (e.g. "web"). */
	appName: string;
}

class ServerEnvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ServerEnvError";
	}
}

function validateAuthSecret(secret: string): string | null {
	// Auth.js will tolerate any non-empty string, but anything below a real
	// 32-byte secret is brittle to brute-force on the JWT signature. Reject
	// it at boot so a typo / placeholder can never reach production.
	const byteLength = Buffer.byteLength(secret, "utf8");
	if (byteLength < AUTH_SECRET_MIN_BYTES) {
		return `AUTH_SECRET is ${byteLength} bytes; needs at least ${AUTH_SECRET_MIN_BYTES} bytes of entropy. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`;
	}
	return null;
}

function validateMongoUri(uri: string): string | null {
	// Loose pattern — covers both standard and SRV connection strings — but
	// strict enough to catch a copy-pasted localhost URL or empty placeholder.
	if (!/^mongodb(\+srv)?:\/\/.+/.test(uri)) {
		return "MONGODB_URI must start with mongodb:// or mongodb+srv://";
	}
	return null;
}

function validateOne(name: RequiredVar, value: string | undefined): string | null {
	if (!value || value.trim() === "") {
		return `${name} is not set`;
	}
	if (name === "AUTH_SECRET") {
		return validateAuthSecret(value);
	}
	if (name === "MONGODB_URI") {
		return validateMongoUri(value);
	}
	return null;
}

/**
 * Run all required-env checks. Throws a single aggregated error listing every
 * missing/invalid variable so an operator can fix them in one go instead of
 * starting, failing, fixing, restarting, repeat.
 */
export function assertServerEnv(options: AssertServerEnvOptions): void {
	const failures: string[] = [];
	for (const name of REQUIRED_VARS) {
		const failure = validateOne(name, process.env[name]);
		if (failure) {
			failures.push(failure);
		}
	}
	if (failures.length === 0) {
		logger.info({ app: options.appName }, "server-env: all required variables present");
		return;
	}
	const summary = failures.map((line) => `  • ${line}`).join("\n");
	const message = `[${options.appName}] server environment is not configured:\n${summary}\nSee .env.example for the full list.`;
	// Log structured first so the operator gets a redacted, machine-readable
	// signal too — then throw so the process exits non-zero on boot.
	logger.fatal({ app: options.appName, failures }, "server-env: refusing to start");
	throw new ServerEnvError(message);
}
