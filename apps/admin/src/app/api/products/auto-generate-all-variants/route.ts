import { Attribute, connectDB, handleMongoError, Product } from "@store/db";
import { buildCartesianAttributeCombinations, ok, resolveProductAttributeConfig } from "@store/shared";
import { requireSession } from "@/lib/api/requireSession";
import mongoose from "mongoose";

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

export async function POST(request: Request) {
	const { response } = await requireSession("product_update");
	if (response) return response;

	try {
		await connectDB();
		const body = await request.json().catch(() => ({}));
		const targetProductId = (body as { productId?: string })?.productId;

		const filter = targetProductId ? { _id: targetProductId } : {};
		const products = await Product.find(filter).lean();

		let updatedCount = 0;
		let totalVariantsGenerated = 0;
		const results: Array<{ id: string; name: string; variantCount: number }> = [];

		for (const prod of products) {
			const categorySlug = prod.categorySlug;
			const categoryAttrs = await Attribute.find({ categorySlug, isActive: true }).lean();

			if (categoryAttrs.length === 0) continue;

			const categoryAttrRefs = categoryAttrs.map((a) => ({
				slug: a.slug,
				options: a.options,
			}));

			const rawConfigInput = {
				attributeSlugs: prod.attributeSlugs && prod.attributeSlugs.length > 0 ? prod.attributeSlugs : categoryAttrs.map((a) => a.slug),
				attributeOptionPool: prod.attributeOptionPool ?? {},
				attributeCustomOptions: prod.attributeCustomOptions ?? {},
				attributeDefaults: prod.attributeDefaults ?? {},
				variants: prod.variants ?? [],
			};

			const productConfig = resolveProductAttributeConfig(rawConfigInput, categoryAttrRefs);
			const comboResult = buildCartesianAttributeCombinations(productConfig);

			if (!comboResult.ok) continue;

			const existingVariants = prod.variants ?? [];
			const basePrice = existingVariants.find((v) => v.priceRupees > 0)?.priceRupees ?? 1;
			const baseDiscount = existingVariants.find((v) => v.discountRupees !== undefined)?.discountRupees ?? 0;
			const variantWithImages = existingVariants.find((v) => v.images && v.images.length > 0);
			const fallbackImages = variantWithImages?.images ?? prod.images ?? [];

			const newVariants = comboResult.combinations.map((combo) => {
				let bestMatch: typeof existingVariants[0] | null = null;
				let maxScore = -1;

				for (const existing of existingVariants) {
					const score = attributeMatchScore(existing.attributes ?? {}, combo);
					if (score > maxScore) {
						maxScore = score;
						bestMatch = existing;
					}
				}

				const imagesToUse = (bestMatch?.images && bestMatch.images.length > 0) ? bestMatch.images : fallbackImages;
				const priceToUse = bestMatch && bestMatch.priceRupees > 0 ? bestMatch.priceRupees : basePrice;
				const discountToUse = bestMatch?.discountRupees ?? baseDiscount;
				const forceOutOfStock = bestMatch?.forceOutOfStock ?? false;
				const warrantyDays = bestMatch?.warrantyDays ?? undefined;

				return {
					id: bestMatch?.id && maxScore > 0 ? bestMatch.id : new mongoose.Types.ObjectId().toHexString(),
					priceRupees: priceToUse,
					discountRupees: discountToUse,
					quantity: bestMatch?.quantity && bestMatch.quantity > 0 ? bestMatch.quantity : 1,
					forceOutOfStock,
					warrantyDays,
					attributes: combo,
					images: imagesToUse,
				};
			});

			await Product.updateOne(
				{ _id: prod._id },
				{
					$set: {
						attributeSlugs: productConfig.attributeSlugs,
						attributeOptionPool: productConfig.attributeOptionPool,
						variants: newVariants,
					},
				},
			);

			updatedCount += 1;
			totalVariantsGenerated += newVariants.length;
			results.push({ id: prod._id.toString(), name: prod.name, variantCount: newVariants.length });
		}

		return ok({
			message: `Successfully auto-generated variants for ${updatedCount} products (${totalVariantsGenerated} total variants created with copied images).`,
			results,
		});
	} catch (error) {
		return handleMongoError(error);
	}
}
