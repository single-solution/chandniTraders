import { requireSession } from "@/lib/api/requireSession";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { PRODUCT_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { badRequest, calculateProductSeoScore, created, isValidationError, ok, parseBody, slugify, validateString, type StoredImage } from "@store/shared";

import { Brand, Category, connectDB, getStoreSettings, handleMongoError, Product } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";

import { brandLookupKey, summariseProduct, toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { type BrandLean } from "@/lib/serializers/brand";
import type { AdminProductSummary } from "@/types/models";
import { validateVariantsBatch, type VariantInput } from "@/lib/api/variantValidation";
import { validateProductImages } from "@/lib/api/productImagesValidation";
import { parseSeoPayload } from "@/lib/api/seoPayload";

export async function GET(request: Request) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const { page, limit, skip, search, searchPattern } = readListOptions(request);
		const url = new URL(request.url);
		const categoryFilter = url.searchParams.get("category");
		const includeArchived = url.searchParams.get("includeArchived") === "true";

		const filter: Record<string, unknown> = {};
		if (search) {
			filter.$or = [{ name: { $regex: searchPattern, $options: "i" } }, { slug: { $regex: searchPattern, $options: "i" } }];
		}
		if (categoryFilter) {
			filter.categorySlug = categoryFilter;
		}
		if (!includeArchived) {
			filter.isArchived = { $ne: true };
		}

		const [docs, total, brandDocs, storeSettings] = await Promise.all([
			Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<ProductLean[]>(),
			Product.countDocuments(filter),
			Brand.find().lean<BrandLean[]>(),
			getStoreSettings(),
		]);

		const brandsByCategoryAndSlug = new Map(brandDocs.flatMap((brand) => brand.categorySlugs.map((categorySlug) => [brandLookupKey(categorySlug, brand.slug), brand] as const)));

		const storeName = storeSettings.siteName?.trim() || "Chandni Traders";
		const items = docs.map((doc) => summariseProduct(doc, brandsByCategoryAndSlug, storeName));

		const payload: ListResponse<AdminProductSummary> = { items, total, page, limit };
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}

interface ProductCreateInput {
	name?: unknown;
	slug?: unknown;
	brandSlug?: unknown;
	categorySlug?: unknown;
	isFeatured?: unknown;
	isActive?: unknown;
	variants?: unknown;
	images?: unknown;
	seo?: unknown;
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("product_create");
	if (response) {
		return response;
	}

	const body = await parseBody<ProductCreateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const nameResult = validateString(body.name, {
		label: "Name",
		max: PRODUCT_FIELD_LIMITS.name,
	});
	if (isValidationError(nameResult)) {
		return badRequest(nameResult.error);
	}

	if (typeof body.brandSlug !== "string" || body.brandSlug.length === 0) {
		return badRequest("brandSlug is required.");
	}
	if (typeof body.categorySlug !== "string" || body.categorySlug.length === 0) {
		return badRequest("categorySlug is required.");
	}
	const brandSlug = slugify(body.brandSlug, 64);
	const categorySlug = slugify(body.categorySlug, 64);

	const slug = typeof body.slug === "string" && body.slug.trim().length > 0 ? slugify(body.slug, PRODUCT_FIELD_LIMITS.slug) : slugify(nameResult, PRODUCT_FIELD_LIMITS.slug);
	if (slug.length === 0) {
		return badRequest("Slug could not be derived from name.");
	}

	await connectDB();
	try {
		const [brandExists, categoryExists] = await Promise.all([Brand.exists({ slug: brandSlug, categorySlugs: categorySlug }), Category.exists({ slug: categorySlug })]);
		if (!brandExists) return badRequest(`Brand '${brandSlug}' is not linked to this category.`);
		if (!categoryExists) return badRequest(`Category '${categorySlug}' not found.`);

		// Optional variants — the new `/products/new` flow posts everything in
		// a single request. Each entry is validated against the category's
		// grade + attribute catalog before insertion.
		const variantPayload: Record<string, unknown>[] = [];
		if (Array.isArray(body.variants)) {
			const batch = await validateVariantsBatch(body.variants as VariantInput[], true, { categorySlug, brandSlug });
			if (!batch.ok) {
				return badRequest(batch.error);
			}
			variantPayload.push(...batch.values);
		}

		// A product must carry at least one photo as soon as any variant is
		// attached — empty shells (Step 1 of the wizard) are allowed to skip.
		let images: StoredImage[] = [];
		const requiresImages = variantPayload.length > 0;
		const imagesResult = validateProductImages(body.images, {
			required: requiresImages,
		});
		if (!imagesResult.ok) {
			return badRequest(imagesResult.error);
		}
		images = imagesResult.value;

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

		const storeSettings = await getStoreSettings();
		const storeName = storeSettings.siteName?.trim() || "Chandni Traders";
		const brand = await Brand.findOne({
			slug: brandSlug,
			categorySlugs: categorySlug,
		}).lean<BrandLean>();

		const score = calculateProductSeoScore(nameResult, brand?.name || "", seo, images.length > 0, storeName);

		if (!seo) seo = {};
		seo.score = score;

		const doc = await Product.create({
			slug,
			name: nameResult,
			brandSlug,
			categorySlug,
			isFeatured: body.isFeatured === true,
			isActive: body.isActive !== false,
			isArchived: false,
			images,
			variants: variantPayload,
			...(seo ? { seo } : {}),
		});

		await recordActivity({
			actor,
			action: "created",
			resourceType: "product",
			resourceId: doc._id.toString(),
			resourceLabel: doc.name,
		});
		// New product is now visible to customers — flush both the admin
		// dashboard cache (so models-listed / unitsInStock updates) and the
		// storefront cache (so listings reflect the new SKU immediately).
		bustAdminCaches();

		return created(toProductResponse(doc.toObject() as unknown as ProductLean, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}
