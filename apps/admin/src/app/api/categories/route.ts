import { requireSession } from "@/lib/api/requireSession";
import { badRequest, created, isValidationError, normalizeStructuredContent, ok, parseBody, slugify, normalizeIconName, validateString } from "@store/shared";
import { Category, connectDB, handleMongoError } from "@store/db";

import { CATEGORY_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { bustAdminCaches } from "@/lib/cached";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { recordActivity } from "@/lib/services/activityLog";
import { toCategoryResponse, type CategoryLean } from "@/lib/serializers/category";
import { parseSeoPayload } from "@/lib/api/seoPayload";
import type { AdminCategory } from "@/types/models";

export async function GET(request: Request) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const { page, limit, skip, search, searchPattern } = readListOptions(request);
		const filter: Record<string, unknown> = {};
		if (search) {
			filter.$or = [{ label: { $regex: searchPattern, $options: "i" } }, { slug: { $regex: searchPattern, $options: "i" } }];
		}
		const [docs, total] = await Promise.all([
			Category.find(filter).sort({ sortOrder: 1, label: 1 }).skip(skip).limit(limit).lean<CategoryLean[]>(),
			Category.countDocuments(filter),
		]);
		const payload: ListResponse<AdminCategory> = {
			items: docs.map(toCategoryResponse),
			total,
			page,
			limit,
		};
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}

interface CategoryCreateInput {
	label?: unknown;
	description?: unknown;
	slug?: unknown;
	icon?: unknown;
	isActive?: unknown;
	sortOrder?: unknown;
	content?: unknown;
	seo?: unknown;
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}

	const body = await parseBody<CategoryCreateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const labelResult = validateString(body.label, {
		label: "Label",
		max: CATEGORY_FIELD_LIMITS.label,
	});
	if (isValidationError(labelResult)) {
		return badRequest(labelResult.error);
	}

	const descriptionResult = validateString(body.description, {
		label: "Description",
		max: CATEGORY_FIELD_LIMITS.description,
	});
	if (isValidationError(descriptionResult)) {
		return badRequest(descriptionResult.error);
	}

	const slug = typeof body.slug === "string" && body.slug.trim().length > 0 ? slugify(body.slug) : slugify(labelResult);
	if (slug.length === 0) {
		return badRequest("Slug could not be derived from label.");
	}

	const icon = normalizeIconName(body.icon);

	let seo: Record<string, unknown> | undefined;
	if (body.seo !== undefined) {
		const parsed = parseSeoPayload(body.seo);
		if ("response" in parsed) {
			return parsed.response;
		}
		if ("seo" in parsed) {
			seo = parsed.seo as Record<string, unknown>;
		}
	}

	await connectDB();
	try {
		const lastCategory = await Category.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean<{ sortOrder?: number }>();
		const nextSortOrder = typeof lastCategory?.sortOrder === "number" ? lastCategory.sortOrder + 1 : 0;
		const content = normalizeStructuredContent(body.content, descriptionResult);
		const payload: Record<string, unknown> = {
			slug,
			label: labelResult,
			description: content.summary || descriptionResult,
			icon,
			isActive: body.isActive !== false,
			sortOrder: nextSortOrder,
			content,
		};
		if (seo) {
			payload.seo = seo;
		}
		const doc = await Category.create(payload);

		void recordActivity({
			actor,
			action: "created",
			resourceType: "category",
			resourceId: doc._id.toString(),
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return created(toCategoryResponse(doc.toObject() as unknown as CategoryLean));
	} catch (error) {
		return handleMongoError(error);
	}
}
