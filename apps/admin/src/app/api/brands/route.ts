import { requireSession } from "@/lib/api/requireSession";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { BRAND_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { badRequest, conflict, created, isValidationError, ok, parseBody, validateString } from "@store/shared";

import { Brand, connectDB, handleMongoError } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { slugify } from "@store/shared";

import { toBrandResponse, type BrandLean } from "@/lib/serializers/brand";
import type { AdminBrand } from "@/types/models";
import { parseSeoPayload } from "@/lib/api/seoPayload";

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
			filter.$or = [{ name: { $regex: searchPattern, $options: "i" } }, { slug: { $regex: searchPattern, $options: "i" } }];
		}

		const [docs, total] = await Promise.all([Brand.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean<BrandLean[]>(), Brand.countDocuments(filter)]);

		const payload: ListResponse<AdminBrand> = {
			items: docs.map(toBrandResponse),
			total,
			page,
			limit,
		};
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}

interface BrandInput {
	name?: unknown;
	categorySlugs?: unknown;
	slug?: unknown;
	isActive?: unknown;
	seo?: unknown;
}

function validateCategorySlugs(input: unknown): string[] | { error: string } {
	if (!Array.isArray(input) || input.length === 0) {
		return { error: "Brand must reference at least one category." };
	}
	const out: string[] = [];
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
		out.push(slug);
	}
	return out;
}

async function hasBrandCategoryConflict(slug: string, categorySlugs: string[]): Promise<boolean> {
	const existing = await Brand.exists({
		slug,
		categorySlugs: { $in: categorySlugs },
	});
	return Boolean(existing);
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("brand_manage");
	if (response) {
		return response;
	}

	const body = await parseBody<BrandInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const nameResult = validateString(body.name, { label: "Name", max: BRAND_FIELD_LIMITS.name });
	if (isValidationError(nameResult)) {
		return badRequest(nameResult.error);
	}

	const categorySlugsResult = validateCategorySlugs(body.categorySlugs);
	if ("error" in categorySlugsResult) {
		return badRequest(categorySlugsResult.error);
	}

	const slug = typeof body.slug === "string" && body.slug.trim().length > 0 ? slugify(body.slug) : slugify(nameResult);
	if (slug.length === 0) {
		return badRequest("Slug could not be derived from name.");
	}

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
	if (await hasBrandCategoryConflict(slug, categorySlugsResult)) {
		return conflict("A brand with this name already exists in this category.");
	}

	try {
		const doc = await Brand.create({
			slug,
			name: nameResult,
			categorySlugs: categorySlugsResult,
			isActive: body.isActive !== false,
			...(seo ? { seo } : {}),
		});
		void recordActivity({
			actor,
			action: "created",
			resourceType: "brand",
			resourceId: doc._id.toString(),
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return created(toBrandResponse(doc.toObject() as unknown as BrandLean));
	} catch (error) {
		return handleMongoError(error);
	}
}
