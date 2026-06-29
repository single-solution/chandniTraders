import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(scriptDir, "../.env.local");

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

loadEnvFile(envLocalPath);

const wooBase = (process.env.WOO_BASE_URL ?? "https://chandnitraders.pk").replace(/\/$/, "");
const wooKey = process.env.WOO_CONSUMER_KEY;
const wooSecret = process.env.WOO_CONSUMER_SECRET;

async function wooFetch(path) {
	const url = new URL(`${wooBase}/wp-json/wc/v3${path}`);
	url.searchParams.set("consumer_key", wooKey);
	url.searchParams.set("consumer_secret", wooSecret);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`WooCommerce ${path} failed: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function main() {
    const products = await wooFetch("/products?per_page=5&status=publish");
    for (const p of products) {
        console.log(`Product: ${p.name} (ID: ${p.id}, Type: ${p.type})`);
        console.log(`Price: ${p.price}`);
        console.log(`Attributes:`, JSON.stringify(p.attributes, null, 2));
        
        if (p.type === 'variable') {
            const variations = await wooFetch(`/products/${p.id}/variations`);
            console.log(`Variations:`, JSON.stringify(variations.map(v => ({
                id: v.id,
                price: v.price,
                attributes: v.attributes
            })), null, 2));
        }
        console.log("---");
    }
}

main().catch(console.error);
