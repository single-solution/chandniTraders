import type { Types } from "mongoose";
import type { CategoryAttributes, WithTimestamps } from "@store/db";
import { DEFAULT_ICON, asString, normalizeIconName, normalizeStructuredContent, objectIdString, toIsoDate } from "@store/shared";
import type { AdminCategory } from "@/types/models";

export type CategoryLean = WithTimestamps<CategoryAttributes> & {
	_id: Types.ObjectId;
};

export function toCategoryResponse(category: CategoryLean): AdminCategory {
	return {
		id: objectIdString(category._id),
		slug: asString(category.slug),
		label: asString(category.label),
		description: asString(category.description),
		icon: normalizeIconName(category.icon, DEFAULT_ICON),
		isActive: category.isActive ?? true,
		sortOrder: category.sortOrder ?? 0,
		content: normalizeStructuredContent(category.content, asString(category.description)),
		seo: category.seo,
		createdAt: toIsoDate(category.createdAt),
		updatedAt: toIsoDate(category.updatedAt),
	};
}
