import type { Types } from "mongoose";
import type { BrandAttributes, WithTimestamps } from "@store/db";
import { asArray, asString, objectIdString, toIsoDate } from "@store/shared";
import type { AdminBrand } from "@/types/models";

export type BrandLean = WithTimestamps<BrandAttributes> & {
	_id: Types.ObjectId;
};

export function toBrandResponse(brand: BrandLean): AdminBrand {
	return {
		id: objectIdString(brand._id),
		slug: asString(brand.slug),
		name: asString(brand.name),
		logoUrl: asString(brand.logoUrl) || undefined,
		categorySlugs: asArray<string>(brand.categorySlugs),
		isActive: brand.isActive ?? true,
		seo: brand.seo,
		createdAt: toIsoDate(brand.createdAt),
		updatedAt: toIsoDate(brand.updatedAt),
	};
}
