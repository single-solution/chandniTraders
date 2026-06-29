import { requireSession } from "@/lib/api/requireSession";
import {
	badRequest,
	conflict,
	isValidationError,
	isValidId,
	noContent,
	normalizeStructuredContent,
	notFound,
	ok,
	parseBody,
	slugify,
	normalizeIconName,
	validateString,
} from "@store/shared";

import { Attribute, Brand, Category, connectDB, handleMongoError, Product } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";

import { CATEGORY_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { parseSeoPayload } from "@/lib/api/seoPayload";

import { toCategoryResponse, type CategoryLean } from "@/lib/serializers/category";
import { cascadeCategorySlugChange, categorySlugTaken, slugFromCatalogLabel } from "@/lib/services/catalogSlugSync";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface CategoryUpdateInput {
	label?: unknown;
	description?: unknown;
	slug?: unknown;
	icon?: unknown;
	isActive?: unknown;
	sortOrder?: unknown;
	content?: unknown;
	seo?: unknown;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const doc = await Category.findById(id).lean<CategoryLean>();
	if (!doc) {
		return notFound("Category not found");
	}
	return ok(toCategoryResponse(doc));
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<CategoryUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};

	if (body.label !== undefined) {
		const result = validateString(body.label, {
			label: "Label",
			max: CATEGORY_FIELD_LIMITS.label,
		});
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.label = result;
	}
	if (body.description !== undefined) {
		const result = validateString(body.description, {
			label: "Description",
			max: CATEGORY_FIELD_LIMITS.description,
		});
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.description = result;
	}
	const explicitSlug = body.slug !== undefined && typeof body.slug === "string" ? body.slug : undefined;

	if (explicitSlug !== undefined) {
		const slug = slugify(explicitSlug);
		if (slug.length === 0) {
			return badRequest("Slug cannot be empty.");
		}
		update.slug = slug;
	} else if (typeof update.label === "string") {
		update.slug = slugFromCatalogLabel(update.label as string, 64);
	}
	if (body.icon !== undefined) {
		update.icon = normalizeIconName(body.icon);
	}
	if (body.isActive !== undefined) {
		update.isActive = Boolean(body.isActive);
	}
	if (typeof body.sortOrder === "number") {
		update.sortOrder = body.sortOrder;
	}
	if (body.content !== undefined) {
		const fallbackSummary = typeof update.description === "string" ? (update.description as string) : typeof body.description === "string" ? body.description : "";
		const content = normalizeStructuredContent(body.content, fallbackSummary);
		update.content = content;
		if (content.summary) {
			update.description = content.summary.slice(0, CATEGORY_FIELD_LIMITS.description);
		}
	}
	if (body.seo !== undefined) {
		const parsed = parseSeoPayload(body.seo);
		if ("response" in parsed) {
			return parsed.response;
		}
		if ("seo" in parsed) {
			update.seo = parsed.seo;
		}
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const current = await Category.findById(id).select("slug").lean<{ slug: string }>();
		if (!current) {
			return notFound("Category not found");
		}

		if (typeof update.slug === "string") {
			if (await categorySlugTaken(update.slug as string, id)) {
				return conflict("A category with this slug already exists.");
			}
		}

		const doc = await Category.findByIdAndUpdate(
			id,
			{ $set: update },
			{
				new: true,
				runValidators: true,
			},
		).lean<CategoryLean>();
		if (!doc) {
			return notFound("Category not found");
		}

		if (typeof update.slug === "string" && update.slug !== current.slug) {
			await cascadeCategorySlugChange(current.slug, update.slug as string);
		}

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "category",
			resourceId: id,
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return ok(toCategoryResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	// Look up by slug — that's how every dependent doc references this row.
	const doc = await Category.findById(id).select("slug label").lean<{
		slug: string;
		label: string;
	}>();
	if (!doc) {
		return notFound("Category not found");
	}

	// Block delete when anything still references this category.
	const [productCount, brandCount, attributeCount] = await Promise.all([
		Product.countDocuments({ categorySlug: doc.slug }),
		Brand.countDocuments({ categorySlugs: doc.slug }),
		Attribute.countDocuments({ categorySlug: doc.slug }),
	]);

	const blockingCounts = { productCount, brandCount, attributeCount };
	const total = productCount + brandCount + attributeCount;
	if (total > 0) {
		return conflict(`Cannot delete a category with ${total} dependent records. Toggle isActive instead. (${JSON.stringify(blockingCounts)})`);
	}

	try {
		await Category.deleteOne({ _id: id });
		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "category",
			resourceId: id,
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
