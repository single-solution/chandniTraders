import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "../packages/db/src/connection.js";
import { Product } from "../packages/db/src/models/Product.js";

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

function parsePrice(value) {
	const amount = Number.parseFloat(String(value ?? "0"));
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return Math.round(amount);
}

async function fetchAllWooProducts() {
	const rows = [];
	let page = 1;
	while (true) {
		const batch = await wooFetch(`/products?per_page=100&page=${page}&status=publish`);
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return rows;
}

async function fetchVariations(productId) {
	const rows = [];
	let page = 1;
	while (true) {
		const batch = await wooFetch(`/products/${productId}/variations?per_page=100&page=${page}&status=publish`);
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return rows;
}

async function main() {
  await connectDB();
  console.log("Fetching products from WooCommerce...");
  const wooProducts = await fetchAllWooProducts();
  console.log(`Fetched ${wooProducts.length} products from WooCommerce.`);

  let updatedCount = 0;

  for (const wooProduct of wooProducts) {
    const slug = wooProduct.slug?.trim();
    if (!slug) continue;

    const dbProduct = await Product.findOne({ slug });
    if (!dbProduct) continue;

    let changed = false;
    const variants = dbProduct.variants.map(v => v.toObject());

    if (wooProduct.type === "variable") {
      const variations = await fetchVariations(wooProduct.id);
      // We'll just update prices for existing variants if they match, or recreate them.
      // But since our DB already has custom attributes, let's just update the price of the first variant 
      // or try to match. To be safe and keep our custom attributes, we will just update the price of all variants 
      // to the minimum variation price if we can't match exactly.
      let minPrice = parsePrice(wooProduct.price);
      for (const v of variations) {
        const vp = parsePrice(v.sale_price) ?? parsePrice(v.regular_price) ?? parsePrice(v.price);
        if (vp && (!minPrice || vp < minPrice)) minPrice = vp;
      }
      
      if (minPrice) {
        for (const v of variants) {
          if (v.priceRupees !== minPrice) {
            v.priceRupees = minPrice;
            changed = true;
          }
        }
      }
    } else {
      const price = parsePrice(wooProduct.sale_price) ?? parsePrice(wooProduct.regular_price) ?? parsePrice(wooProduct.price);
      if (price) {
        for (const v of variants) {
          if (v.priceRupees !== price) {
            v.priceRupees = price;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await Product.updateOne({ _id: dbProduct._id }, { $set: { variants } });
      updatedCount++;
      console.log(`Updated price for: ${dbProduct.name}`);
    }
  }

  console.log(`Updated prices for ${updatedCount} products.`);
  process.exit(0);
}

main().catch(console.error);
