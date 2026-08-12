import { Attribute, connectDB, handleMongoError, Product } from "@store/db";

import { ok } from "@store/shared";
import { requireSession } from "@/lib/api/requireSession";

export async function POST() {
	const { response } = await requireSession("product_update");
	if (response) return response;

	try {
		await connectDB();
		const products = await Product.find({}).lean();
		let updatedCount = 0;

		for (const prod of products) {
			const categorySlug = prod.categorySlug;
			const categoryAttrs = await Attribute.find({ categorySlug, isActive: true }).select("slug").lean();
			const activeSlugs = new Set(categoryAttrs.map((a) => a.slug));

			// Filter product attributeSlugs to only valid category attributes
			const cleanSlugs = (prod.attributeSlugs ?? []).filter((s) => activeSlugs.has(s));

			// Clean attributeOptionPool
			const cleanPool: Record<string, string[]> = {};
			if (prod.attributeOptionPool) {
				for (const [k, v] of Object.entries(prod.attributeOptionPool)) {
					if (activeSlugs.has(k)) {
						cleanPool[k] = v;
					}
				}
			}

			// Clean variant attributes
			const cleanVariants = (prod.variants ?? []).map((v) => {
				const newAttrs: Record<string, string | string[]> = {};
				if (v.attributes) {
					for (const [attrKey, attrVal] of Object.entries(v.attributes)) {
						if (activeSlugs.has(attrKey)) {
							newAttrs[attrKey] = attrVal;
						}
					}
				}
				return {
					...v,
					attributes: newAttrs,
				};
			});

			await Product.updateOne(
				{ _id: prod._id },
				{
					$set: {
						attributeSlugs: cleanSlugs,
						attributeOptionPool: cleanPool,
						variants: cleanVariants,
					},
				},
			);
			updatedCount += 1;
		}

		return ok({ message: `Successfully cleaned legacy attributes on ${updatedCount} products.` });
	} catch (error) {
		return handleMongoError(error);
	}
}
