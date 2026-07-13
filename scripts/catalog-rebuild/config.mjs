/**
 * Shared config for the catalog rebuild pipeline.
 *
 * Loads WooCommerce + MongoDB credentials from the repo-root `.env.local`
 * and exposes a small authenticated WooCommerce fetch helper plus the
 * on-disk paths every pipeline stage reads and writes.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

function loadEnvFile(path) {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const index = trimmed.indexOf("=");
		const key = trimmed.slice(0, index).trim();
		const value = trimmed.slice(index + 1).trim();
		if (!process.env[key]) process.env[key] = value;
	}
}

loadEnvFile(resolve(repoRoot, ".env.local"));

export const mongoUri = process.env.MONGODB_URI;
export const wooBase = (process.env.WOO_BASE_URL ?? "https://chandnitraders.pk").replace(/\/$/, "");
const wooKey = process.env.WOO_CONSUMER_KEY;
const wooSecret = process.env.WOO_CONSUMER_SECRET;

export const dataDir = resolve(scriptDir, ".data");
export const montageDir = resolve(dataDir, "montages");
export const paths = {
	wooCatalog: resolve(dataDir, "woo-catalog.json"),
	montageIndex: resolve(dataDir, "montage-index.json"),
	colorDecisions: resolve(scriptDir, "color-decisions.json"),
	plan: resolve(dataDir, "plan.json"),
	report: resolve(scriptDir, "dry-run-report.md"),
};

export function ensureDataDirs() {
	mkdirSync(dataDir, { recursive: true });
	mkdirSync(montageDir, { recursive: true });
}

export function requireWooCreds() {
	if (!wooKey || !wooSecret) {
		throw new Error("WOO_CONSUMER_KEY and WOO_CONSUMER_SECRET are required in .env.local");
	}
}

export async function wooFetch(path) {
	requireWooCreds();
	const url = new URL(`${wooBase}/wp-json/wc/v3${path}`);
	url.searchParams.set("consumer_key", wooKey);
	url.searchParams.set("consumer_secret", wooSecret);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`WooCommerce ${path} failed: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

export async function wooFetchAll(pathBuilder) {
	const rows = [];
	let page = 1;
	while (true) {
		const batch = await wooFetch(pathBuilder(page));
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return rows;
}
