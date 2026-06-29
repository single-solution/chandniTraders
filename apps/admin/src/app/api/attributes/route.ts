import { requireSession } from "@/lib/api/requireSession";
import { badRequest, conflict, created, isValidationError, ok, parseBody, slugify, validateString } from "@store/shared";

import { Attribute, connectDB, handleMongoError } from "@store/db";
import { ATTRIBUTE_CARD_POSITIONS } from "@store/db";

import { ATTRIBUTE_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { bustAdminCaches } from "@/lib/cached";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { recordActivity } from "@/lib/services/activityLog";
import { toAttributeResponse, type AttributeLean } from "@/lib/serializers/attribute";
import { parseAttributeOptions, parseAttributeUnit, parseAttributeVisibilityInput } from "@/lib/api/attributesPayload";
import type { AdminAttribute } from "@/types/models";

async function hasAttributeCategoryConflict(categorySlug: string, slug: string): Promise<boolean> {
	const existing = await Attribute.exists({ categorySlug, slug });
	return Boolean(existing);
}

export async function GET(request: Request) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const { page, limit, skip, search, searchPattern } = readListOptions(request);
		const url = new URL(request.url);
		const categorySlug = url.searchParams.get("categorySlug");
		const filter: Record<string, unknown> = {};
		if (categorySlug) {
			filter.categorySlug = categorySlug;
		}
		if (search) {
			filter.$or = [{ label: { $regex: searchPattern, $options: "i" } }, { slug: { $regex: searchPattern, $options: "i" } }];
		}
		const [docs, total] = await Promise.all([
			Attribute.find(filter).sort({ categorySlug: 1, label: 1 }).skip(skip).limit(limit).lean<AttributeLean[]>(),
			Attribute.countDocuments(filter),
		]);
		const payload: ListResponse<AdminAttribute> = {
			items: docs.map(toAttributeResponse),
			total,
			page,
			limit,
		};
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}

interface AttributeCreateInput {
	categorySlug?: unknown;
	label?: unknown;
	unit?: unknown;
	options?: unknown;
	cardPosition?: unknown;
	slug?: unknown;
	visibility?: unknown;
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}

	const body = await parseBody<AttributeCreateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	if (typeof body.categorySlug !== "string" || body.categorySlug.trim().length === 0) {
		return badRequest("categorySlug is required.");
	}

	const labelResult = validateString(body.label, {
		label: "Label",
		max: ATTRIBUTE_FIELD_LIMITS.label,
	});
	if (isValidationError(labelResult)) {
		return badRequest(labelResult.error);
	}

	const unitResult = parseAttributeUnit(body.unit);
	if (typeof unitResult === "object" && "error" in unitResult) {
		return badRequest(unitResult.error);
	}

	const optionsResult = parseAttributeOptions(body.options, unitResult);
	if ("error" in optionsResult) {
		return badRequest(optionsResult.error);
	}

	const cardPosition =
		typeof body.cardPosition === "string" && (ATTRIBUTE_CARD_POSITIONS as readonly string[]).includes(body.cardPosition)
			? (body.cardPosition as (typeof ATTRIBUTE_CARD_POSITIONS)[number])
			: "title-chips";

	const slug = typeof body.slug === "string" && body.slug.trim().length > 0 ? slugify(body.slug, 60) : slugify(labelResult, 60);
	if (slug.length === 0) {
		return badRequest("Slug could not be derived from label.");
	}
	const categorySlug = slugify(body.categorySlug, 64);

	let visibility: import("@store/shared").AttributeVisibility = {
		type: "always",
	};
	if (body.visibility !== undefined) {
		const visibilityResult = parseAttributeVisibilityInput(body.visibility);
		if ("error" in visibilityResult) {
			return badRequest(visibilityResult.error);
		}
		visibility = visibilityResult;
	}

	await connectDB();
	if (await hasAttributeCategoryConflict(categorySlug, slug)) {
		return conflict("An attribute with this label already exists in this category.");
	}

	try {
		const doc = await Attribute.create({
			categorySlug,
			slug,
			label: labelResult,
			...(unitResult ? { unit: unitResult } : {}),
			options: optionsResult.options,
			visibility,
			cardPosition,
			isActive: true,
		});
		void recordActivity({
			actor,
			action: "created",
			resourceType: "attribute",
			resourceId: doc._id.toString(),
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return created(toAttributeResponse(doc.toObject() as unknown as AttributeLean));
	} catch (error) {
		return handleMongoError(error);
	}
}
