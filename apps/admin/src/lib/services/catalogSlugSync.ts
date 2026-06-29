/**
 * Keep catalog slugs aligned with human-readable labels/names and cascade
 * slug changes to dependent documents (products, brands, visibility rules).
 */

import mongoose from "mongoose";
import { slugify } from "@store/shared";
import { Attribute, Brand, Category, Product } from "@store/db";

export function slugFromCatalogLabel(label: string, maxLength: number, explicitSlug?: unknown): string {
	if (typeof explicitSlug === "string" && explicitSlug.trim().length > 0) {
		return slugify(explicitSlug, maxLength);
	}
	return slugify(label, maxLength);
}

export async function cascadeCategorySlugChange(oldSlug: string, newSlug: string): Promise<void> {
	if (oldSlug === newSlug) {
		return;
	}

	await Promise.all([
		Product.updateMany({ categorySlug: oldSlug }, { $set: { categorySlug: newSlug } }),
		Attribute.updateMany({ categorySlug: oldSlug }, { $set: { categorySlug: newSlug } }),
	]);

	const brands = await Brand.find({ categorySlugs: oldSlug }).select("categorySlugs");
	for (const brand of brands) {
		brand.categorySlugs = brand.categorySlugs.map((slug) => (slug === oldSlug ? newSlug : slug));
		await brand.save();
	}
}

export async function cascadeBrandSlugChange(oldSlug: string, newSlug: string): Promise<void> {
	if (oldSlug === newSlug) {
		return;
	}
	await Product.updateMany({ brandSlug: oldSlug }, { $set: { brandSlug: newSlug } });

	const brandGated = await Attribute.find({
		"visibility.type": "brand",
		"visibility.brandSlugs": oldSlug,
	}).select("visibility");

	for (const attribute of brandGated) {
		const visibility = attribute.visibility;
		if (!visibility?.brandSlugs) continue;
		visibility.brandSlugs = visibility.brandSlugs.map((slug) => (slug === oldSlug ? newSlug : slug));
		attribute.visibility = visibility;
		attribute.markModified("visibility");
		await attribute.save();
	}
}

export async function cascadeAttributeSlugChange(categorySlug: string, oldSlug: string, newSlug: string): Promise<void> {
	if (oldSlug === newSlug) {
		return;
	}

	const products = await Product.find({ categorySlug }).select("variants");
	for (const product of products) {
		let touched = false;
		for (const variant of product.variants) {
			if (variant.attributes && Object.prototype.hasOwnProperty.call(variant.attributes, oldSlug)) {
				variant.attributes[newSlug] = variant.attributes[oldSlug];
				delete variant.attributes[oldSlug];
				touched = true;
			}
			if (variant.attributeDisplay && Object.prototype.hasOwnProperty.call(variant.attributeDisplay, oldSlug)) {
				variant.attributeDisplay[newSlug] = variant.attributeDisplay[oldSlug];
				delete variant.attributeDisplay[oldSlug];
				touched = true;
			}
		}
		if (touched) {
			product.markModified("variants");
			await product.save();
		}
	}
}

export async function categorySlugTaken(slug: string, excludeId?: string): Promise<boolean> {
	const filter: Record<string, unknown> = { slug };
	if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
		filter._id = { $ne: excludeId };
	}
	return Boolean(await Category.exists(filter));
}
