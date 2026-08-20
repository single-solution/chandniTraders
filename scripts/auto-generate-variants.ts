import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Attribute, connectDB, Product } from "@store/db";
import { buildCartesianAttributeCombinations, resolveProductAttributeConfig } from "@store/shared";

function loadEnv() {
	const envPaths = [
		path.join(process.cwd(), "apps/admin/.env.local"),
		path.join(process.cwd(), "apps/admin/.env"),
		path.join(process.cwd(), "apps/web/.env.local"),
		path.join(process.cwd(), ".env.local"),
		path.join(process.cwd(), ".env"),
	];
	for (const envPath of envPaths) {
		if (fs.existsSync(envPath)) {
			const content = fs.readFileSync(envPath, "utf8");
			for (const line of content.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const eqIdx = trimmed.indexOf("=");
				if (eqIdx > 0) {
					const key = trimmed.slice(0, eqIdx).trim();
					let val = trimmed.slice(eqIdx + 1).trim();
					if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
						val = val.slice(1, -1);
					}
					if (!process.env[key]) {
						process.env[key] = val;
					}
				}
			}
		}
	}
}

loadEnv();

function attributeMatchScore(existingAttrs: Record<string, string | string[]>, comboAttrs: Record<string, string>): number {
	let score = 0;
	for (const [key, val] of Object.entries(comboAttrs)) {
		const existingVal = existingAttrs[key];
		if (!existingVal) continue;
		if (Array.isArray(existingVal)) {
			if (existingVal.some((v) => v.toLowerCase() === val.toLowerCase())) score += 2;
		} else if (existingVal.toLowerCase() === val.toLowerCase()) {
			score += 2;
		}
	}
	return score;
}

export async function autoGenerateVariantsForProduct(productId: string) {
	await connectDB();
	const product = await Product.findById(productId).lean();
	if (!product) throw new Error("Product not found");

	const categorySlug = product.categorySlug;
	const categoryAttrs = await Attribute.find({ categorySlug, isActive: true }).lean();

	if (categoryAttrs.length === 0) {
		return { success: false, message: `No active attributes defined for category '${categorySlug}'.` };
	}

	const categoryAttrRefs = categoryAttrs.map((a) => ({
		slug: a.slug,
		options: a.options,
	}));

	// Default to enabling all category attributes if product has no explicit subset
	const rawConfigInput = {
		attributeSlugs: product.attributeSlugs && product.attributeSlugs.length > 0 ? product.attributeSlugs : categoryAttrs.map((a) => a.slug),
		attributeOptionPool: product.attributeOptionPool ?? {},
		attributeCustomOptions: product.attributeCustomOptions ?? {},
		attributeDefaults: product.attributeDefaults ?? {},
		variants: product.variants ?? [],
	};

	const productConfig = resolveProductAttributeConfig(rawConfigInput, categoryAttrRefs);
	const comboResult = buildCartesianAttributeCombinations(productConfig);

	if (!comboResult.ok) {
		return { success: false, message: comboResult.error };
	}

	const existingVariants = product.variants ?? [];
	const firstVariant = existingVariants[0];
	const firstVariantWithPrice = existingVariants.find((v) => v.priceRupees > 0);
	const firstVariantWithImages = existingVariants.find((v) => v.images && v.images.length > 0);

	const priceToUse = firstVariant && firstVariant.priceRupees > 0 ? firstVariant.priceRupees : (firstVariantWithPrice?.priceRupees ?? 1);
	const discountToUse = firstVariant?.discountRupees ?? (firstVariantWithPrice?.discountRupees ?? 0);
	const quantityToUse = firstVariant?.quantity && firstVariant.quantity > 0 ? firstVariant.quantity : 1;
	const forceOutOfStock = firstVariant?.forceOutOfStock ?? false;
	const warrantyDays = firstVariant?.warrantyDays ?? undefined;
	const imagesToUse = (firstVariant?.images && firstVariant.images.length > 0) ? firstVariant.images : (firstVariantWithImages?.images ?? product.images ?? []);

	const newVariants = comboResult.combinations.map((combo) => {
		// Find matching existing variant ID if exact attribute combo match exists
		const exactMatch = existingVariants.find((existing) => {
			const existingAttrs = existing.attributes ?? {};
			return Object.keys(combo).every((k) => {
				const ev = existingAttrs[k];
				return typeof ev === "string" ? ev.toLowerCase() === combo[k].toLowerCase() : false;
			});
		});

		return {
			id: exactMatch?.id ?? new mongoose.Types.ObjectId().toHexString(),
			priceRupees: priceToUse,
			discountRupees: discountToUse,
			quantity: quantityToUse,
			forceOutOfStock,
			warrantyDays,
			attributes: combo,
			images: imagesToUse,
		};
	});

	await Product.updateOne(
		{ _id: product._id },
		{
			$set: {
				attributeSlugs: productConfig.attributeSlugs,
				attributeOptionPool: productConfig.attributeOptionPool,
				variants: newVariants,
			},
		},
	);

	return {
		success: true,
		productName: product.name,
		variantCount: newVariants.length,
	};
}

export async function autoGenerateVariantsAllProducts() {
	await connectDB();
	const products = await Product.find({}).select("_id name").lean();
	console.log(`Processing ${products.length} products...`);

	let updatedCount = 0;
	let totalVariantsGenerated = 0;

	for (const prod of products) {
		try {
			const res = await autoGenerateVariantsForProduct(prod._id.toString());
			if (res.success) {
				updatedCount += 1;
				totalVariantsGenerated += res.variantCount ?? 0;
				console.log(`✓ [${prod.name}] Generated ${res.variantCount} variants with copied images.`);
			} else {
				console.log(`- [${prod.name}] Skipped: ${res.message}`);
			}
		} catch (err) {
			console.error(`✕ Error on [${prod.name}]:`, err);
		}
	}

	console.log(`Done! Updated ${updatedCount}/${products.length} products. Generated ${totalVariantsGenerated} total variants.`);
}

// Allow running from CLI directly
if (process.argv[1]?.endsWith("auto-generate-variants.ts") || process.argv[1]?.endsWith("auto-generate-variants.js")) {
	autoGenerateVariantsAllProducts()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Migration failed:", err);
			process.exit(1);
		});
}
