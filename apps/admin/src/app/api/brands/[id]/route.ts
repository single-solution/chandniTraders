import { Brand, connectDB, handleMongoError, Product } from "@store/db";
import { badRequest, conflict, isValidId, isValidationError, noContent, notFound, ok, parseBody, validateString } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { toBrandResponse, type BrandLean } from "@/lib/serializers/brand";
import { recordActivity } from "@/lib/services/activityLog";
import { slugify } from "@store/shared";
import { BRAND_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { parseSeoPayload } from "@/lib/api/seoPayload";
import { cascadeBrandSlugChange, slugFromCatalogLabel } from "@/lib/services/catalogSlugSync";

interface RouteContext {
	params: Promise<{ id: string }>;
}

function validateCategorySlugs(input: unknown): string[] | { error: string } {
	if (!Array.isArray(input) || input.length === 0) {
		return { error: "Brand must reference at least one category." };
	}
	const categorySlugs: string[] = [];
	const seen = new Set<string>();
	for (const raw of input) {
		if (typeof raw !== "string" || raw.trim().length === 0) {
			return { error: "Each category slug must be a non-empty string." };
		}
		const slug = slugify(raw, 64);
		if (seen.has(slug)) {
			return { error: "Brand cannot reference the same category more than once." };
		}
		seen.add(slug);
		categorySlugs.push(slug);
	}
	return categorySlugs;
}

async function hasBrandCategoryConflict(id: string, slug: string, categorySlugs: string[]): Promise<boolean> {
	const existing = await Brand.exists({
		_id: { $ne: id },
		slug,
		categorySlugs: { $in: categorySlugs },
	});
	return Boolean(existing);
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
	const doc = await Brand.findById(id).lean<BrandLean>();
	if (!doc) {
		return notFound("Brand not found");
	}

	return ok(toBrandResponse(doc));
}

interface BrandUpdateInput {
	name?: unknown;
	categorySlugs?: unknown;
	slug?: unknown;
	isActive?: unknown;
	seo?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("brand_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<BrandUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};
	let nextSlug: string | null = null;
	let nextCategorySlugs: string[] | null = null;

	if (body.name !== undefined) {
		const result = validateString(body.name, { label: "Name", max: BRAND_FIELD_LIMITS.name });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.name = result;
	}
	if (body.categorySlugs !== undefined) {
		const categorySlugs = validateCategorySlugs(body.categorySlugs);
		if ("error" in categorySlugs) {
			return badRequest(categorySlugs.error);
		}
		update.categorySlugs = categorySlugs;
		nextCategorySlugs = categorySlugs;
	}
	if (body.slug !== undefined && typeof body.slug === "string") {
		const slug = slugify(body.slug);
		if (slug.length === 0) {
			return badRequest("Slug cannot be empty.");
		}
		update.slug = slug;
		nextSlug = slug;
	}
	if (body.isActive !== undefined) {
		update.isActive = Boolean(body.isActive);
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
		const current = await Brand.findById(id).select("slug categorySlugs name").lean<{ slug: string; categorySlugs: string[]; name: string }>();
		if (!current) {
			return notFound("Brand not found");
		}

		if (typeof update.name === "string" && nextSlug === null) {
			const derivedSlug = slugFromCatalogLabel(update.name as string, 64);
			update.slug = derivedSlug;
			nextSlug = derivedSlug;
		}

		const conflictSlug = nextSlug ?? current.slug;
		const conflictCategorySlugs = nextCategorySlugs ?? current.categorySlugs;
		if (await hasBrandCategoryConflict(id, conflictSlug, conflictCategorySlugs)) {
			return conflict("A brand with this slug already exists in this category.");
		}

		const doc = await Brand.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean<BrandLean>();
		if (!doc) {
			return notFound("Brand not found");
		}

		if (typeof update.slug === "string" && update.slug !== current.slug) {
			await cascadeBrandSlugChange(current.slug, update.slug as string);
		}

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "brand",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return ok(toBrandResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("brand_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	// Referential integrity: a brand with products attached can't be hard-deleted
	// — toggle `isActive` to hide it instead. Products now reference brands by
	// slug; resolve to slug first so the countDocuments uses the new column.
	const brandForLookup = await Brand.findById(id).select("slug categorySlugs").lean<{ slug: string; categorySlugs: string[] }>();
	const productCount = brandForLookup
		? await Product.countDocuments({
				brandSlug: brandForLookup.slug,
				categorySlug: { $in: brandForLookup.categorySlugs },
			})
		: 0;
	if (productCount > 0) {
		return conflict(`Cannot delete a brand with ${productCount} product${productCount === 1 ? "" : "s"}. Mark it inactive instead.`);
	}

	try {
		const doc = await Brand.findByIdAndDelete(id).lean<BrandLean>();
		if (!doc) {
			return notFound("Brand not found");
		}

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "brand",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
