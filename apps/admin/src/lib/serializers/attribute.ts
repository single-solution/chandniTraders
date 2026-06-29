import type { Types } from "mongoose";
import type { AttributeAttributes, WithTimestamps } from "@store/db";
import { asArray, asString, normalizeAttributeCardPosition, objectIdString, parseAttributeVisibility, sortAttributeOptions, toIsoDate } from "@store/shared";
import type { AdminAttribute } from "@/types/models";

export type AttributeLean = WithTimestamps<AttributeAttributes> & {
	_id: Types.ObjectId;
};

export function toAttributeResponse(attr: AttributeLean): AdminAttribute {
	return {
		id: objectIdString(attr._id),
		categorySlug: asString(attr.categorySlug),
		slug: asString(attr.slug),
		label: asString(attr.label),
		options: sortAttributeOptions(
			asArray<NonNullable<AttributeAttributes["options"]>[number]>(attr.options).map((option) => ({
				value: asString(option?.value),
				label: asString(option?.label),
			})),
			attr?.unit ? asString(attr.unit) : undefined,
		),
		unit: attr?.unit ? asString(attr.unit) : undefined,
		visibility: parseAttributeVisibility(attr.visibility),
		cardPosition: normalizeAttributeCardPosition(attr.cardPosition),
		isActive: attr.isActive ?? true,
		createdAt: toIsoDate(attr.createdAt),
		updatedAt: toIsoDate(attr.updatedAt),
	};
}
